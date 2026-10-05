-- Trolift Solutions — 0017 invoices + order-time customer snapshots
--
-- Tax invoices are generated from immutable history:
--   * orders gains customer identity snapshots (name/phone/email as they
--     were at order time; the customer master may change later). Backfilled
--     from the master, then NOT NULL going forward.
--   * invoices stores one row per invoiced order: a server-generated,
--     never-reused invoice number plus the frozen invoice JSON (see
--     lib/invoices/data.ts). A trigger forbids altering frozen data, so
--     re-generated PDFs can never silently change after order, product
--     or customer edits.
--   * Numbering is {PREFIX}/{FY}/{SEQ}, e.g. INV/FY26-27/000042:
--     unique (sequence + UNIQUE), server-side (SECURITY DEFINER function
--     callable by the service role only), gap-tolerant but never reused,
--     and FY-aware without hard-coding any year (April–March computed
--     from the invoice date). The literal prefix is configuration
--     (TROLIFT_INVOICE_PREFIX, default INV), not schema.
--   * create_order() is replaced to persist the customer snapshots.

-- ─── Order-time customer identity snapshots ──────────────────────────
alter table public.orders
  add column if not exists customer_name_snapshot text,
  add column if not exists customer_phone_snapshot text,
  add column if not exists customer_email_snapshot text
    check (customer_email_snapshot is null
      or customer_email_snapshot ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$');

update public.orders o
set customer_name_snapshot = c.name,
    customer_phone_snapshot = c.phone,
    customer_email_snapshot = c.email
from public.customers c
where o.customer_id = c.id
  and o.customer_name_snapshot is null;

alter table public.orders
  alter column customer_name_snapshot set not null,
  alter column customer_phone_snapshot set not null;

-- ─── Invoice numbering (sequence + FY-aware generator) ───────────────
create sequence if not exists public.invoice_number_seq;

-- Indian financial year for a date (April–March), e.g. FY26-27.
-- Pure date math: no year is ever hard-coded.
create or replace function public.invoice_financial_year(
  p_date date default CURRENT_DATE
)
returns text
language sql
immutable
set search_path = public
as $$
  select 'FY'
    || to_char(p_date - interval '3 months', 'YY')
    || '-'
    || to_char(p_date + interval '9 months', 'YY');
$$;

-- Server-side number: PREFIX/FY/SEQ (e.g. INV/FY26-27/000042).
-- nextval() is atomic: concurrent callers always get distinct numbers.
-- Rolled-back transactions leave gaps (never reassignments).
create or replace function public.generate_invoice_number(
  p_prefix text default 'INV'
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text := upper(trim(p_prefix));
begin
  if v_prefix !~ '^[A-Z]{2,10}$' then
    raise exception 'invalid invoice prefix' using errcode = 'raise_exception';
  end if;
  return v_prefix
    || '/'
    || public.invoice_financial_year(CURRENT_DATE)
    || '/'
    || lpad(nextval('public.invoice_number_seq')::text, 6, '0');
end;
$$;

revoke all on function public.generate_invoice_number(text) from public;
grant execute on function public.generate_invoice_number(text) to service_role;

revoke all on function public.invoice_financial_year(date) from public;
grant execute on function public.invoice_financial_year(date) to service_role;

-- ─── Invoices (one frozen record per invoiced order) ─────────────────
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique
    references public.orders (id) on delete cascade,
  invoice_number text not null unique check (
    invoice_number ~ '^[A-Z]{2,10}/FY[0-9]{2}-[0-9]{2}/[0-9]{4,}$'
  ),
  invoice_date date not null default CURRENT_DATE,
  -- Frozen invoice JSON (canonical InvoiceData). NULL only between
  -- number-claim and content-freeze within a single service request;
  -- the trigger below forbids any change once set.
  data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists invoices_order_idx on public.invoices (order_id);
create index if not exists invoices_number_idx on public.invoices (invoice_number);

create trigger invoices_set_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();

-- Frozen means frozen: once data is set, no UPDATE may change it.
create or replace function public.freeze_invoice_data()
returns trigger
language plpgsql
as $$
begin
  if old.data is not null and new.data is distinct from old.data then
    raise exception 'invoice data is frozen' using errcode = 'raise_exception';
  end if;
  if new.order_id is distinct from old.order_id
    or new.invoice_number is distinct from old.invoice_number then
    raise exception 'invoice identity is immutable' using errcode = 'raise_exception';
  end if;
  return new;
end;
$$;

drop trigger if exists invoices_freeze_data on public.invoices;
create trigger invoices_freeze_data
  before update on public.invoices
  for each row execute function public.freeze_invoice_data();

-- ─── Access: service role + admins only (mirror orders) ─────────────
alter table public.invoices enable row level security;

grant all on public.invoices to authenticated;

create policy invoices_admin_all
  on public.invoices for all
  to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant usage, select on sequence public.invoice_number_seq to authenticated;

-- ─── create_order(): persist customer identity snapshots ────────────
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
    taxable_amount, cgst_amount, sgst_amount, igst_amount,
    customer_name_snapshot, customer_phone_snapshot, customer_email_snapshot
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
    nullif(p_customer ->> 'email', '')
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
