-- Trolift Solutions — 0016 GST billing snapshots + line tax
--
-- B2B GST support with frozen history:
--   * customers gains optional billing profile columns (master data;
--     editing them never touches past orders).
--   * products gains gst_rate percent (NULL = no GST configured → 0%).
--   * orders gains billing + tax snapshots plus a widened total CHECK:
--       total = subtotal + cgst + sgst + igst + delivery
--     (old rows carry zeros, so the new CHECK still holds for them).
--   * order_items gains per-line gst_rate_percent + line_tax_amount
--     snapshots for invoice rendering.
--   * create_order() is replaced to accept and persist the new
--     snapshots atomically (same idempotency + atomicity contract).

-- ─── Customer billing profile (master, editable) ──────────────────────
alter table public.customers
  add column if not exists billing_name text
    check (billing_name is null or char_length(billing_name) between 1 and 200),
  add column if not exists billing_address_line text
    check (billing_address_line is null or char_length(billing_address_line) between 1 and 500),
  add column if not exists billing_city text
    check (billing_city is null or char_length(billing_city) between 1 and 100),
  add column if not exists billing_state text
    check (billing_state is null or char_length(billing_state) between 1 and 100),
  add column if not exists billing_state_code text
    check (billing_state_code is null or billing_state_code ~ '^[0-9]{2}$'),
  add column if not exists billing_pincode text
    check (billing_pincode is null or billing_pincode ~ '^[1-9][0-9]{5}$');

-- ─── Product GST rate (percent, e.g. 18.00; NULL = not configured) ────
alter table public.products
  add column if not exists gst_rate numeric(5, 2)
  constraint products_gst_rate_check check (
    gst_rate is null or (gst_rate >= 0 and gst_rate <= 100)
  );

-- ─── Order billing + tax snapshots (immutable history) ────────────────
alter table public.orders
  add column if not exists tax_treatment text not null default 'non_gst'
    constraint orders_tax_treatment_check check (tax_treatment in ('non_gst', 'gst')),
  add column if not exists billing_name text,
  add column if not exists billing_address_line text,
  add column if not exists billing_city text,
  add column if not exists billing_state text,
  add column if not exists billing_state_code text
    check (billing_state_code is null or billing_state_code ~ '^[0-9]{2}$'),
  add column if not exists billing_pincode text
    check (billing_pincode is null or billing_pincode ~ '^[1-9][0-9]{5}$'),
  add column if not exists taxable_amount numeric(12, 2) not null default 0
    check (taxable_amount >= 0),
  add column if not exists cgst_amount numeric(12, 2) not null default 0
    check (cgst_amount >= 0),
  add column if not exists sgst_amount numeric(12, 2) not null default 0
    check (sgst_amount >= 0),
  add column if not exists igst_amount numeric(12, 2) not null default 0
    check (igst_amount >= 0);

alter table public.orders
  drop constraint if exists orders_total_check;
alter table public.orders
  add constraint orders_total_check check (
    total_amount = subtotal + delivery_charge + cgst_amount + sgst_amount + igst_amount
  );

alter table public.order_items
  add column if not exists gst_rate_percent numeric(5, 2)
    check (gst_rate_percent is null or (gst_rate_percent >= 0 and gst_rate_percent <= 100)),
  add column if not exists line_tax_amount numeric(12, 2) not null default 0
    check (line_tax_amount >= 0);

-- ─── create_order(): accept + persist billing/tax snapshots ──────────
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

  select id into v_existing from public.orders
  where idempotency_key = p_idempotency_key;
  if v_existing is not null then
    return v_existing;
  end if;

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
    taxable_amount, cgst_amount, sgst_amount, igst_amount
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
    coalesce((p_order ->> 'igst_amount'), '0')::numeric
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

revoke all on function public.create_order(text, jsonb, jsonb, jsonb, jsonb) from public;
grant execute on function public.create_order(text, jsonb, jsonb, jsonb, jsonb) to service_role;
