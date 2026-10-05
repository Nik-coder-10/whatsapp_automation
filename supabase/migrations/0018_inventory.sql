-- Trolift Solutions — 0018 production-safe inventory
--
-- Policy (see docs; enforced here, not just in app code):
--   * RESERVE at order creation: create_order() atomically holds units
--     (stock itself untouched). Holds expire after the payment window;
--     every create_order() sweeps expired holds first, so no scheduler
--     is needed and abandoned carts can never strand stock forever.
--   * CONSUME at payment verification: reservations convert to real
--     decrements only when money is verified (approve path).
--   * RESTORE on legitimate cancellation: held units are released, or
--     consumed units returned — exactly once, gated by orders.stock_state.
--   * Atomicity: single-row UPDATE ... WHERE stock >= qty style guards
--     live inside SECURITY DEFINER RPCs with row locks; SELECT-then-
--     UPDATE across round trips never happens.
--   * Audit: every movement lands in inventory_events with the resulting
--     on-hand balance, so discrepancies are debuggable.

-- ─── Product threshold ──────────────────────────────────────────────
alter table public.products
  add column if not exists low_stock_threshold integer not null default 5
  check (low_stock_threshold >= 0);

-- ─── Order stock state (exactly-once consume/restore gate) ──────────
alter table public.orders
  add column if not exists stock_state text not null default 'none'
  check (stock_state in ('none', 'reserved', 'consumed', 'restored'));

-- ─── Reservation holds (never indefinite: expires_at always set) ────
create table if not exists public.stock_reservations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null
    references public.products (id) on delete restrict,
  order_id uuid not null
    references public.orders (id) on delete cascade,
  quantity integer not null check (quantity > 0),
  status text not null default 'held'
    check (status in ('held', 'consumed', 'restored')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint stock_reservations_order_product_unique unique (order_id, product_id)
);

create index if not exists stock_reservations_product_idx
  on public.stock_reservations (product_id);
create index if not exists stock_reservations_expiry_idx
  on public.stock_reservations (expires_at)
  where status = 'held';

-- ─── Inventory audit log ────────────────────────────────────────────
create table if not exists public.inventory_events (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null
    references public.products (id) on delete restrict,
  order_id uuid
    references public.orders (id) on delete cascade,
  event text not null check (
    event in ('reserved', 'consumed', 'released', 'restored', 'adjusted')
  ),
  -- Signed on-hand delta (reserve/release/restore-of-hold move 0 units
  -- on hand; consume is negative; restore-of-sale and manual adds are
  -- positive). balance_after is the resulting stock_quantity.
  quantity integer not null,
  balance_after integer not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists inventory_events_product_idx
  on public.inventory_events (product_id, created_at desc);
create index if not exists inventory_events_order_idx
  on public.inventory_events (order_id)
  where order_id is not null;

-- ─── Access: service role + admins only (mirror orders) ─────────────
alter table public.stock_reservations enable row level security;
alter table public.inventory_events enable row level security;

grant all on public.stock_reservations to authenticated;
grant all on public.inventory_events to authenticated;

create policy reservations_admin_all
  on public.stock_reservations for all
  to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy inventory_events_admin_all
  on public.inventory_events for all
  to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ─── search_products(): expose the low-stock threshold ──────────────
-- Same signature and semantics as 0008; one extra output column so the
-- storefront can resolve availability status without a second lookup.
-- Return-type change: OR REPLACE cannot do that, so drop first (no
-- callers hold the old shape across a migration transaction).
drop function if exists public.search_products(
  text, text, numeric, numeric, text, integer, integer
);
create function public.search_products(
  p_query text,
  p_category text default null,
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_sort text default 'relevance',
  p_limit integer default 12,
  p_offset integer default 0
)
returns table (
  id uuid,
  name text,
  slug text,
  description text,
  category text,
  specifications jsonb,
  price numeric(12, 2),
  stock_quantity integer,
  low_stock_threshold integer,
  images text[],
  is_active boolean,
  rank real,
  total_count bigint
)
language plpgsql
stable
set search_path = public
as $$
declare
  v_pattern text :=
    '%' || replace(replace(replace(p_query, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  v_limit integer := least(greatest(coalesce(p_limit, 12), 1), 48);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  return query
  with matched as (
    select
      p.*,
      similarity(
        coalesce(p.name, '') || ' ' ||
        coalesce(p.category, '') || ' ' ||
        coalesce(p.description, ''),
        p_query
      ) as rnk
    from public.products p
    where p.is_active = true
      and (
        p.name ilike v_pattern
        or p.category ilike v_pattern
        or p.description ilike v_pattern
        or p.slug ilike v_pattern
      )
      and (p_category is null or p.category = p_category)
      and (p_min_price is null or p.price >= p_min_price)
      and (p_max_price is null or p.price <= p_max_price)
  )
  select
    m.id, m.name, m.slug, m.description, m.category,
    m.specifications, m.price, m.stock_quantity, m.low_stock_threshold,
    m.images, m.is_active,
    m.rnk, count(*) over() as total_count
  from matched m
  order by
    case when p_sort = 'price_asc' then m.price end asc,
    case when p_sort = 'price_desc' then m.price end desc,
    case when p_sort = 'name_asc' then m.name end asc,
    case when p_sort = 'relevance' then m.rnk end desc,
    m.created_at desc
  limit v_limit offset v_offset;
end;
$$;

revoke all on function public.search_products(
  text, text, numeric, numeric, text, integer, integer
) from public;
grant execute on function public.search_products(
  text, text, numeric, numeric, text, integer, integer
) to anon, authenticated;

-- ─── Availability read (reserve-aware, count-safe for storefront) ───
-- available = on-hand minus live (unexpired, still-held) reservations,
-- floored at 0. Callers render `status` only; exact counts stay internal.
create or replace function public.product_availability(p_ids uuid[])
returns table (
  product_id uuid,
  available integer,
  low_stock_threshold integer,
  status text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    greatest(
      p.stock_quantity - coalesce((
        select sum(r.quantity)::integer
        from public.stock_reservations r
        where r.product_id = p.id
          and r.status = 'held'
          and r.expires_at > now()
      ), 0),
      0
    ),
    p.low_stock_threshold,
    case
      when p.stock_quantity - coalesce((
        select sum(r.quantity)::integer
        from public.stock_reservations r
        where r.product_id = p.id
          and r.status = 'held'
          and r.expires_at > now()
      ), 0) <= 0 then 'out_of_stock'
      when p.stock_quantity - coalesce((
        select sum(r.quantity)::integer
        from public.stock_reservations r
        where r.product_id = p.id
          and r.status = 'held'
          and r.expires_at > now()
      ), 0) <= p.low_stock_threshold then 'low_stock'
      else 'in_stock'
    end
  from public.products p
  where p.id = any (p_ids);
$$;

revoke all on function public.product_availability(uuid[]) from public;
grant execute on function public.product_availability(uuid[]) to anon, authenticated, service_role;

-- ─── create_order(): reserve-first, all-or-nothing ──────────────────
create or replace function public.create_order(
  p_idempotency_key text,
  p_customer jsonb,
  p_order jsonb,
  p_items jsonb,
  p_payment jsonb,
  p_reservation_hours integer default 48
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing uuid;
  v_customer_id uuid;
  v_order_id uuid;
  v_item jsonb;
  v_pid uuid;
  v_product record;
  v_available integer;
  v_expires_at timestamptz;
begin
  if p_idempotency_key is null or p_idempotency_key = '' then
    raise exception 'idempotency key is required' using errcode = 'raise_exception';
  end if;

  select id into v_existing from public.orders
  where idempotency_key = p_idempotency_key;
  if v_existing is not null then
    return v_existing;
  end if;

  if p_reservation_hours is null or p_reservation_hours < 1 then
    raise exception 'reservation window is required' using errcode = 'raise_exception';
  end if;
  v_expires_at := now() + (p_reservation_hours || ' hours')::interval;

  -- Self-maintaining expiry: every order attempt releases stale holds
  -- first (with audit rows), so abandoned carts never strand stock and
  -- no scheduler is required. The CTE logs from RETURNING because the
  -- rows are gone after the delete.
  with swept as (
    delete from public.stock_reservations
    where status = 'held'
      and expires_at <= now()
    returning product_id, order_id, quantity
  )
  insert into public.inventory_events
    (product_id, order_id, event, quantity, balance_after, note)
  select s.product_id, s.order_id, 'released', 0, p.stock_quantity,
    'hold expired'
  from swept s
  join public.products p on p.id = s.product_id;

  -- Lock all ordered products up-front, in id order (deadlock-safe),
  -- so the check-and-hold below is one atomic unit per transaction.
  for v_pid in
    select distinct (elem ->> 'product_id')::uuid
    from jsonb_array_elements(p_items) as elem
    order by 1
  loop
    perform 1 from public.products where id = v_pid for update;
  end loop;

  -- Validate every line against reserve-aware availability BEFORE any
  -- row is written: a shortfall aborts the whole transaction, so an
  -- order is never partially created.
  for v_item in select * from jsonb_array_elements(p_items) loop
    select p.* into v_product from public.products p
    where p.id = (v_item ->> 'product_id')::uuid;
    if v_product.id is null then
      raise exception 'unknown product' using errcode = 'raise_exception';
    end if;
    select greatest(v_product.stock_quantity - coalesce(sum(r.quantity), 0), 0)
      into v_available
    from public.stock_reservations r
    where r.product_id = v_product.id
      and r.status = 'held'
      and r.expires_at > now();
    if v_available is null then
      v_available := v_product.stock_quantity;
    end if;
    if (v_item ->> 'quantity')::integer > v_available then
      raise exception 'INSUFFICIENT_STOCK: only % available of "%"',
        v_available, v_product.name
        using errcode = 'raise_exception';
    end if;
  end loop;

  insert into public.customers (name, phone, email, gstin)
  values (
    p_customer ->> 'name',
    p_customer ->> 'phone',
    nullif(p_customer ->> 'email', ''),
    nullif(p_customer ->> 'gstin', '')
  )
  on conflict (phone) do update set
    name = excluded.name,
    email = coalesce(excluded.email, public.customers.email),
    gstin = coalesce(excluded.gstin, public.customers.gstin),
    updated_at = now()
  returning id into v_customer_id;

  insert into public.orders (
    order_number, customer_id, subtotal, delivery_charge, total_amount,
    delivery_pincode, delivery_partner_id, delivery_partner_name,
    gstin_snapshot, payment_status, order_status, idempotency_key,
    tax_treatment, billing_name, billing_address_line, billing_city,
    billing_state, billing_state_code, billing_pincode,
    taxable_amount, cgst_amount, sgst_amount, igst_amount,
    customer_name_snapshot, customer_phone_snapshot, customer_email_snapshot,
    stock_state
  )
  values (
    coalesce(nullif(p_order ->> 'order_number', ''), public.generate_order_number()),
    v_customer_id,
    (p_order ->> 'subtotal')::numeric,
    (p_order ->> 'delivery_charge')::numeric,
    (p_order ->> 'total_amount')::numeric,
    p_order ->> 'delivery_pincode',
    nullif(p_order ->> 'delivery_partner_id', '')::uuid,
    p_order ->> 'delivery_partner_name',
    nullif(p_order ->> 'gstin_snapshot', ''),
    coalesce(p_order ->> 'payment_status', 'pending'),
    coalesce(p_order ->> 'order_status', 'pending_payment'),
    p_idempotency_key,
    coalesce(p_order ->> 'tax_treatment', 'non_gst'),
    nullif(p_order ->> 'billing_name', ''),
    nullif(p_order ->> 'billing_address_line', ''),
    nullif(p_order ->> 'billing_city', ''),
    nullif(p_order ->> 'billing_state', ''),
    nullif(p_order ->> 'billing_state_code', ''),
    nullif(p_order ->> 'billing_pincode', ''),
    coalesce((p_order ->> 'taxable_amount'), '0')::numeric,
    coalesce((p_order ->> 'cgst_amount'), '0')::numeric,
    coalesce((p_order ->> 'sgst_amount'), '0')::numeric,
    coalesce((p_order ->> 'igst_amount'), '0')::numeric,
    p_customer ->> 'name',
    p_customer ->> 'phone',
    nullif(p_customer ->> 'email', ''),
    'reserved'
  )
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into public.order_items (
      order_id, product_id, product_name, quantity, unit_price, line_total,
      gst_rate_percent, line_tax_amount
    )
    values (
      v_order_id,
      (v_item ->> 'product_id')::uuid,
      v_item ->> 'product_name',
      (v_item ->> 'quantity')::integer,
      (v_item ->> 'unit_price')::numeric,
      (v_item ->> 'line_total')::numeric,
      nullif(v_item ->> 'gst_rate_percent', '')::numeric,
      coalesce((v_item ->> 'line_tax_amount'), '0')::numeric
    );
    insert into public.stock_reservations
      (product_id, order_id, quantity, expires_at)
    values (
      (v_item ->> 'product_id')::uuid,
      v_order_id,
      (v_item ->> 'quantity')::integer,
      v_expires_at
    );
    insert into public.inventory_events
      (product_id, order_id, event, quantity, balance_after, note)
    values (
      (v_item ->> 'product_id')::uuid,
      v_order_id,
      'reserved',
      0,
      (select stock_quantity from public.products
       where id = (v_item ->> 'product_id')::uuid),
      'hold expires ' || v_expires_at::text
    );
  end loop;

  insert into public.payments (order_id, amount, method, status, transaction_reference, metadata)
  values (
    v_order_id,
    (p_payment ->> 'amount')::numeric,
    coalesce(p_payment ->> 'method', 'upi'),
    'pending',
    nullif(p_payment ->> 'transaction_reference', ''),
    coalesce(p_payment -> 'metadata', '{}'::jsonb)
  );

  return v_order_id;
end;
$$;

revoke all on function public.create_order(text, jsonb, jsonb, jsonb, jsonb, integer) from public;
grant execute on function public.create_order(text, jsonb, jsonb, jsonb, jsonb, integer) to service_role;

-- ─── consume: verification converts holds into real decrements ─────
-- Called by the payment-approve path. Idempotent: only 'reserved'
-- orders move; anything else is a no-op success (safe retries).
create or replace function public.consume_reservation(p_order_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state text;
  v_item record;
  v_other_held integer;
  v_stock integer;
begin
  if not (public.is_admin() or auth.uid() is null) then
    raise exception 'not authorized' using errcode = 'raise_exception';
  end if;

  select stock_state into v_state from public.orders
  where id = p_order_id for update;
  if v_state is null then
    raise exception 'unknown order' using errcode = 'raise_exception';
  end if;
  if v_state <> 'reserved' then
    return v_state;
  end if;

  for v_item in
    select product_id, quantity from public.stock_reservations
    where order_id = p_order_id and status = 'held'
    order by product_id
    for update
  loop
    select stock_quantity into v_stock from public.products
    where id = v_item.product_id for update;
    select coalesce(sum(quantity), 0) into v_other_held
    from public.stock_reservations
    where product_id = v_item.product_id
      and status = 'held'
      and expires_at > now()
      and order_id <> p_order_id;
    if v_stock - v_other_held < v_item.quantity then
      raise exception 'INSUFFICIENT_STOCK: hold of % units no longer covered',
        v_item.quantity
        using errcode = 'raise_exception';
    end if;
    update public.products
    set stock_quantity = stock_quantity - v_item.quantity
    where id = v_item.product_id;
    update public.stock_reservations
    set status = 'consumed'
    where order_id = p_order_id and product_id = v_item.product_id;
    insert into public.inventory_events
      (product_id, order_id, event, quantity, balance_after,
       note)
    values (
      v_item.product_id, p_order_id, 'consumed', -v_item.quantity,
      v_stock - v_item.quantity, 'payment verified'
    );
  end loop;

  update public.orders set stock_state = 'consumed' where id = p_order_id;
  return 'consumed';
end;
$$;

revoke all on function public.consume_reservation(uuid) from public;
grant execute on function public.consume_reservation(uuid) to authenticated, service_role;

-- ─── restore: legitimate cancellation returns units exactly once ────
-- 'reserved' → holds released (no on-hand movement).
-- 'consumed' → on-hand incremented back (sale undone).
-- 'restored' / 'none' → no-op success (double-cancel safe).
create or replace function public.restore_reservation(
  p_order_id uuid,
  p_reason text default 'order cancelled'
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state text;
  v_item record;
  v_stock integer;
begin
  if not (public.is_admin() or auth.uid() is null) then
    raise exception 'not authorized' using errcode = 'raise_exception';
  end if;

  select stock_state into v_state from public.orders
  where id = p_order_id for update;
  if v_state is null then
    raise exception 'unknown order' using errcode = 'raise_exception';
  end if;
  if v_state = 'restored' or v_state = 'none' then
    return v_state;
  end if;

  if v_state = 'reserved' then
    for v_item in
      select product_id, quantity from public.stock_reservations
      where order_id = p_order_id and status = 'held'
      order by product_id
      for update
    loop
      select stock_quantity into v_stock from public.products
      where id = v_item.product_id;
      delete from public.stock_reservations
      where order_id = p_order_id and product_id = v_item.product_id;
      insert into public.inventory_events
        (product_id, order_id, event, quantity, balance_after, note)
      values (
        v_item.product_id, p_order_id, 'restored', 0, v_stock, p_reason
      );
    end loop;
    update public.orders set stock_state = 'restored' where id = p_order_id;
    return 'restored';
  end if;

  -- v_state = 'consumed': return the sold units to on-hand.
  for v_item in
    select product_id, quantity from public.stock_reservations
    where order_id = p_order_id and status = 'consumed'
    order by product_id
    for update
  loop
    update public.products
    set stock_quantity = stock_quantity + v_item.quantity
    where id = v_item.product_id;
    update public.stock_reservations
    set status = 'restored'
    where order_id = p_order_id and product_id = v_item.product_id;
    select stock_quantity into v_stock from public.products
    where id = v_item.product_id;
    insert into public.inventory_events
      (product_id, order_id, event, quantity, balance_after, note)
    values (
      v_item.product_id, p_order_id, 'restored', v_item.quantity,
      v_stock, p_reason
    );
  end loop;
  update public.orders set stock_state = 'restored' where id = p_order_id;
  return 'restored';
end;
$$;

revoke all on function public.restore_reservation(uuid, text) from public;
grant execute on function public.restore_reservation(uuid, text) to authenticated, service_role;
