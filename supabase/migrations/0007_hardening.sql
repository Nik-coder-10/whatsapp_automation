-- Trolift Solutions — 0007 production hardening
--
-- Deltas only (earlier migrations untouched):
--   1. Missing FK/admin-list indexes (delivery_partner_id both sides).
--   2. Human-readable order numbers in TS-YYMMDD-SEQ form, e.g.
--      TS-261001-0001, enforced by a CHECK so every row conforms.
--      UUIDs stay the primary keys; order_number is display-only.
--   3. Timestamps on order_items (created_at + updated_at + trigger)
--      so every mutable record has full audit parity.

-- ─── 1. Indexes ───────────────────────────────────────────────────────
-- Admin/ops lookups by partner; FK to delivery_partners.
create index if not exists pincode_rates_partner_idx
  on public.delivery_pincode_rates (delivery_partner_id);

-- Admin/ops lookups by partner on orders.
create index if not exists orders_partner_idx
  on public.orders (delivery_partner_id);

-- ─── 2. Order-number format TS-YYMMDD-SEQ ──────────────────────────────
-- Same shared sequence (global uniqueness, no daily-reset collisions);
-- the date segment is informational only. lpad minimum 4 grows past
-- 9999/day without breaking uniqueness.
create or replace function public.generate_order_number()
returns text
language plpgsql
as $$
begin
  return 'TS-'
    || to_char(now(), 'YYMMDD')
    || '-'
    || lpad(nextval('public.order_number_seq')::text, 4, '0');
end;
$$;

-- Every order_number — generated or hand-supplied — must match the
-- canonical shape. (Pre-hardening dev rows, if any, are test-only.)
alter table public.orders
  add constraint orders_number_format_check
  check (order_number ~ '^TS-[0-9]{6}-[0-9]{4,}$');

-- ─── 3. order_items timestamps ─────────────────────────────────────────
alter table public.order_items
  add column created_at timestamptz not null default now(),
  add column updated_at timestamptz not null default now();

create trigger order_items_set_updated_at
  before update on public.order_items
  for each row execute function public.set_updated_at();
