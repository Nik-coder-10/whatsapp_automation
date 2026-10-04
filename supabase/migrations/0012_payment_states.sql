-- Trolift Solutions — 0012 payment lifecycle states
--
-- The payment flow distinguishes PENDING → SUBMITTED (customer claims
-- payment with a UTR) → PAID (admin-verified) plus FAILED / CANCELLED /
-- REFUNDED. Orders gain PAYMENT_SUBMITTED (claim received, awaiting
-- admin), PROCESSING and DISPATCHED between confirmation and delivery.
--
-- No production rows can hold the old 'verified' value yet (orders only
-- exist in dev), so the sets are replaced outright. Table CHECK names
-- below are PostgreSQL's auto-names for the inline 0004 constraints.

alter table public.payments
  drop constraint if exists payments_status_check;
alter table public.payments
  add constraint payments_status_check check (status in (
    'pending', 'submitted', 'paid', 'failed', 'cancelled', 'refunded'
  ));

alter table public.orders
  drop constraint if exists orders_payment_status_check;
alter table public.orders
  add constraint orders_payment_status_check check (payment_status in (
    'pending', 'submitted', 'paid', 'failed', 'cancelled', 'refunded'
  ));

alter table public.orders
  drop constraint if exists orders_order_status_check;
alter table public.orders
  add constraint orders_order_status_check check (order_status in (
    'draft', 'pending_payment', 'payment_submitted', 'paid', 'confirmed',
    'processing', 'shipped', 'dispatched', 'delivered', 'cancelled'
  ));
