-- Trolift Solutions — 0004 orders + payments
--
-- Snapshot discipline (historical orders never change):
--   orders   keep subtotal / delivery_charge / total_amount + GSTIN snapshot
--            + delivery-partner name snapshot.
--   items    keep product-name / unit-price / line-total snapshots.
-- DB-level CHECKs guarantee total = subtotal + delivery and
-- line_total = quantity * unit_price, so history cannot drift.

-- ─── Orders ───────────────────────────────────────────────────────────
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  -- Human-readable, e.g. TRL-2026-000001. Auto-filled by trigger.
  order_number text not null unique,
  customer_id uuid not null
    references public.customers (id) on delete restrict,
  -- Snapshots in rupees (NUMERIC, never float).
  subtotal numeric(12, 2) not null check (subtotal >= 0),
  delivery_charge numeric(12, 2) not null check (delivery_charge >= 0),
  total_amount numeric(12, 2) not null check (total_amount >= 0),
  constraint orders_total_check check (
    total_amount = subtotal + delivery_charge
  ),
  delivery_pincode text not null check (delivery_pincode ~ '^[1-9][0-9]{5}$'),
  -- Nullable FK (partner may later be deactivated) + mandatory snapshot.
  delivery_partner_id uuid
    references public.delivery_partners (id) on delete set null,
  delivery_partner_name text not null,
  -- GSTIN as it was at order time (customer master may change later).
  gstin_snapshot text check (
    gstin_snapshot is null
    or upper(gstin_snapshot) ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'
  ),
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'verified', 'failed', 'refunded')),
  order_status text not null default 'draft'
    check (order_status in (
      'draft', 'pending_payment', 'paid', 'confirmed',
      'shipped', 'delivered', 'cancelled'
    )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_customer_idx on public.orders (customer_id);
create index orders_status_idx on public.orders (order_status);
create index orders_payment_status_idx on public.orders (payment_status);
create index orders_created_idx on public.orders (created_at desc);

-- Auto-assign order_number when the server omits it.
create or replace function public.assign_order_number()
returns trigger
language plpgsql
as $$
begin
  if new.order_number is null or new.order_number = '' then
    new.order_number := public.generate_order_number();
  end if;
  return new;
end;
$$;

create trigger orders_assign_number
  before insert on public.orders
  for each row execute function public.assign_order_number();

-- ─── Order items ──────────────────────────────────────────────────────
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null
    references public.orders (id) on delete cascade,
  -- RESTRICT: history rows outlive catalogue edits; deletes must be explicit.
  product_id uuid references public.products (id) on delete restrict,
  -- Snapshots at purchase time.
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  line_total numeric(12, 2) not null check (line_total >= 0),
  -- Named *_math_check: PG auto-names the inline line_total CHECK above
  -- order_items_line_total_check, so an explicit name must differ.
  constraint order_items_line_total_math_check check (
    line_total = quantity * unit_price
  ),
  constraint order_items_product_unique unique (order_id, product_id)
);

create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);

-- ─── Payments ─────────────────────────────────────────────────────────
-- No secrets here: only references/handles. UPI credentials and WhatsApp
-- tokens live in server environment variables, never in tables.
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null
    references public.orders (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  method text not null
    check (method in ('upi', 'bank_transfer', 'cash', 'card', 'other')),
  status text not null default 'pending'
    check (status in ('pending', 'verified', 'failed', 'refunded')),
  -- UPI UTR / bank reference supplied by the owner during reconciliation.
  transaction_reference text,
  -- Non-secret context only (screenshots paths, notes, reconciled-by…).
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payments_order_idx on public.payments (order_id);
create index payments_status_idx on public.payments (status);
-- Duplicate UTR submissions are reconciliation errors: reject them.
create unique index payments_reference_unique
  on public.payments (transaction_reference)
  where transaction_reference is not null;

-- ─── updated_at triggers ──────────────────────────────────────────────
create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();
