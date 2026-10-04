-- Trolift Solutions — 0011 atomic order creation
--
-- Idempotent, all-or-nothing order persistence for the order API:
--   * orders.idempotency_key (unique) — double-clicks, retries and
--     refreshes replay to the same order instead of duplicating it.
--   * customers.phone unique — one customer row per mobile number;
--     repeat orders reuse the row (details refreshed).
--   * create_order() — single-transaction customer upsert + order +
--     items + pending payment. Called ONLY by the server (service
--     role) with server-computed snapshots; never granted to anon or
--     authenticated roles. Table CHECKs (totals, line totals, formats)
--     still guard every row it writes.

-- One customer per phone number (normalised to +91… app-side).
create unique index if not exists customers_phone_unique
  on public.customers (phone);

alter table public.orders
  add column if not exists idempotency_key text
  constraint orders_idempotency_unique unique;

create or replace function public.create_order(
  p_idempotency_key text,
  p_customer jsonb,
  p_order jsonb,
  p_items jsonb,
  p_payment jsonb
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
begin
  if p_idempotency_key is null or p_idempotency_key = '' then
    raise exception 'idempotency key is required' using errcode = 'raise_exception';
  end if;

  -- Replay: same key → same order, no new rows.
  select id into v_existing from public.orders
  where idempotency_key = p_idempotency_key;
  if v_existing is not null then
    return v_existing;
  end if;

  -- Customer upsert by phone; refresh details on repeat orders.
  insert into public.customers (name, phone, email, gstin)
  values (
    p_customer ->> 'name',
    p_customer ->> 'phone',
    nullif(p_customer ->> 'email', ''),
    nullif(p_customer ->> 'gstin', '')
  )
  on conflict (phone) do update set
    name = excluded.name,
    email = excluded.email,
    gstin = excluded.gstin,
    updated_at = now()
  returning id into v_customer_id;

  insert into public.orders (
    order_number, customer_id, subtotal, delivery_charge, total_amount,
    delivery_pincode, delivery_partner_id, delivery_partner_name,
    gstin_snapshot, payment_status, order_status, idempotency_key
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
    p_idempotency_key
  )
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into public.order_items (
      order_id, product_id, product_name, quantity, unit_price, line_total
    )
    values (
      v_order_id,
      (v_item ->> 'product_id')::uuid,
      v_item ->> 'product_name',
      (v_item ->> 'quantity')::integer,
      (v_item ->> 'unit_price')::numeric,
      (v_item ->> 'line_total')::numeric
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

-- Server-only: the order API calls this with the service role.
revoke all on function public.create_order(text, jsonb, jsonb, jsonb, jsonb) from public;
grant execute on function public.create_order(text, jsonb, jsonb, jsonb, jsonb) to service_role;
