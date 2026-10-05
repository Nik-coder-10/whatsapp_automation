-- Trolift Solutions — 0019 delivery rule abstraction
--
-- Extends (never replaces) the pincode × partner engine:
--   * products.weight_kg — per-unit shipping weight (NULL = unknown).
--   * delivery_pincode_rates.remote_surcharge — explicit remote-area
--     surcharge, added to the base charge and shown as its own line.
--   * delivery_weight_slabs — per-partner weight bands whose charge
--     REPLACES the pincode base charge for shipments in the band
--     (e.g. 0–10 kg → ₹X). Bands are [min, max); the last band may be
--     open-ended (max NULL). Overlaps are rejected by admin validation.
--   * delivery_category_rules — flat per-order handling surcharge for a
--     product category (e.g. special handling), independent of partner.
--   * orders snapshots delivery_weight_kg + a human-readable
--     delivery_rule_summary, so config edits never rewrite history.
--
-- PRECEDENCE (implemented in lib/delivery/engine.ts, documented there):
--   1. Category handling surcharges (additive, partner-independent).
--   2. Weight slab for the partner (replaces base when the shipment
--      weight falls in a band and every item's weight is known).
--   3. Pincode-partner base charge + remote surcharge.
--   4. Selection among qualifying partners: priority, then lowest
--      partner total. Min/max order windows gate candidacy as before.

-- ─── Product shipping weight ────────────────────────────────────────
alter table public.products
  add column if not exists weight_kg numeric(10, 3)
  check (weight_kg is null or (weight_kg > 0 and weight_kg <= 100000));

-- ─── Remote-area surcharge on pincode rates ─────────────────────────
alter table public.delivery_pincode_rates
  add column if not exists remote_surcharge numeric(12, 2) not null default 0
  check (remote_surcharge >= 0);

-- ─── Per-partner weight slabs ───────────────────────────────────────
create table if not exists public.delivery_weight_slabs (
  id uuid primary key default gen_random_uuid(),
  delivery_partner_id uuid not null
    references public.delivery_partners (id) on delete restrict,
  min_weight_kg numeric(10, 3) not null check (min_weight_kg >= 0),
  max_weight_kg numeric(10, 3) check (
    max_weight_kg is null or max_weight_kg > min_weight_kg
  ),
  charge numeric(12, 2) not null check (charge >= 0),
  created_at timestamptz not null default now(),
  constraint delivery_weight_slabs_band_unique
    unique (delivery_partner_id, min_weight_kg)
);

create index if not exists delivery_weight_slabs_partner_idx
  on public.delivery_weight_slabs (delivery_partner_id);

-- ─── Per-category handling surcharges (flat, per order) ────────────
create table if not exists public.delivery_category_rules (
  id uuid primary key default gen_random_uuid(),
  category text not null unique check (
    char_length(category) between 2 and 100
  ),
  surcharge numeric(12, 2) not null check (surcharge >= 0),
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now()
);

-- ─── Order snapshots (frozen freight facts) ─────────────────────────
alter table public.orders
  add column if not exists delivery_weight_kg numeric(10, 3)
    check (delivery_weight_kg is null or delivery_weight_kg > 0),
  add column if not exists delivery_rule_summary text
    check (delivery_rule_summary is null
      or char_length(delivery_rule_summary) between 1 and 500);

-- ─── Access: service role + admins only (mirror rates) ──────────────
alter table public.delivery_weight_slabs enable row level security;
alter table public.delivery_category_rules enable row level security;

grant all on public.delivery_weight_slabs to authenticated;
grant all on public.delivery_category_rules to authenticated;

create policy weight_slabs_admin_all
  on public.delivery_weight_slabs for all
  to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy category_rules_admin_all
  on public.delivery_category_rules for all
  to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ─── create_order(): persist the frozen freight facts ───────────────
-- Same body as 0018 plus two pass-through snapshot columns (server-
-- computed by the quote; the RPC validates shape, never prices).
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

  for v_pid in
    select distinct (elem ->> 'product_id')::uuid
    from jsonb_array_elements(p_items) as elem
    order by 1
  loop
    perform 1 from public.products where id = v_pid for update;
  end loop;

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
    stock_state, delivery_weight_kg, delivery_rule_summary
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
    'reserved',
    nullif(p_order ->> 'delivery_weight_kg', '')::numeric,
    nullif(p_order ->> 'delivery_rule_summary', '')
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
