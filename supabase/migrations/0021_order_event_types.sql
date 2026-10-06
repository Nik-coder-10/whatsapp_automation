-- Trolift Solutions — 0021 canonical order-event model
--
-- Extends (never replaces) the 0014 order_events audit log with the
-- fields a production timeline needs:
--   * event_type — closed catalog (CHECK). Every lifecycle and
--     operational transition the app performs has exactly one type.
--   * actor_type — 'customer' | 'admin' | 'system' (CHECK). actor_id
--     keeps the existing actor_user_id semantics (auth user for admin
--     actions, customer row id for customer actions, NULL for system).
-- Also replaces create_order() (body identical to 0019) with one
-- addition: an ORDER_CREATED row inserted in the SAME transaction as
-- the order itself, so creation and its audit event commit atomically.
--   * metadata — operational facts only (payment method, item count,
--     totals). Never secrets or PII; enforced by app-layer allowlist.
-- Existing columns (action/from_status/to_status/note/created_at) are
-- untouched: old readers keep working, and the new writers dual-write
-- the legacy `action` string for backward compatibility.
-- RLS is unchanged: authenticated admins read/insert only. No UPDATE
-- or DELETE policy exists — history stays append-only.
--
-- BACKFILL (explicit, no invention): every row written to date came
-- from exactly two server call sites, so provenance is known:
--   * actor_user_id present  → actor_type 'admin' (both call sites run
--     after requireAdmin; no customer/system path ever wrote here).
--   * actor_user_id NULL     → actor_type 'system'.
--   * event_type from the recorded action string; rows from any other
--     (hand-inserted) source map via to_status, falling back to the
--     documented STATUS_CHANGED bucket, which new code never writes.

alter table public.order_events
  add column if not exists event_type text,
  add column if not exists actor_type text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

update public.order_events
set event_type = case action
    when 'payment_verified' then 'PAYMENT_VERIFIED'
    when 'payment_rejected' then 'PAYMENT_REJECTED'
    when 'order_cancelled' then 'CANCELLED'
    when 'status_changed' then case to_status
      when 'confirmed' then 'ORDER_CONFIRMED'
      when 'processing' then 'PROCESSING_STARTED'
      when 'dispatched' then 'DISPATCHED'
      when 'delivered' then 'DELIVERED'
      when 'cancelled' then 'CANCELLED'
      else 'STATUS_CHANGED'
    end
    else 'STATUS_CHANGED'
  end,
  actor_type = case
    when actor_user_id is not null then 'admin'
    else 'system'
  end
where event_type is null or actor_type is null;

alter table public.order_events
  alter column event_type set not null,
  alter column actor_type set not null;

alter table public.order_events
  add constraint order_events_type_check check (
    event_type in (
      'ORDER_CREATED', 'PAYMENT_SUBMITTED', 'PAYMENT_VERIFIED',
      'PAYMENT_REJECTED', 'ORDER_CONFIRMED', 'PROCESSING_STARTED',
      'PACKED', 'READY_FOR_DISPATCH', 'DISPATCHED', 'DELIVERED',
      'CANCELLED', 'INVOICE_ISSUED', 'STATUS_CHANGED'
    )
  ),
  add constraint order_events_actor_check check (
    actor_type in ('customer', 'admin', 'system')
  );

create index if not exists order_events_created_idx
  on public.order_events (created_at desc);
create index if not exists order_events_type_idx
  on public.order_events (event_type);

-- ─── create_order(): emit ORDER_CREATED in-transaction ──────────────
-- Body identical to 0019 plus one insert: the creation event commits
-- in the SAME transaction as the order, so an order can never exist
-- without its birth event (and a failed order leaves no orphan
-- event). Actor is the customer row (guest checkout has no auth
-- user); metadata carries operational facts only — no UTR, phone,
-- or PII.
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

  insert into public.order_events (
    order_id, event_type, actor_type, actor_user_id, action,
    from_status, to_status, metadata
  )
  values (
    v_order_id, 'ORDER_CREATED', 'customer', v_customer_id,
    'order_created', null,
    coalesce(p_order ->> 'order_status', 'pending_payment'),
    jsonb_build_object(
      'payment_method', coalesce(p_payment ->> 'method', 'upi'),
      'item_count', jsonb_array_length(p_items),
      'total_paise',
        round(((p_order ->> 'total_amount')::numeric * 100))::integer
    )
  );

  return v_order_id;
end;
$$;

revoke all on function public.create_order(text, jsonb, jsonb, jsonb, jsonb, integer) from public;
grant execute on function public.create_order(text, jsonb, jsonb, jsonb, jsonb, integer) to service_role;

-- ─── create_order(): emit ORDER_CREATED in-transaction ──────────────
-- Same body as 0019 plus one insert: the creation event commits in the
-- SAME transaction as the order, so an order can never exist without
-- its birth event (and a failed order leaves no orphan event). Actor
-- is the customer row (guest checkout has no auth user); metadata
-- carries operational facts only — no UTR, phone, or PII.
