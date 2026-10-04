-- Trolift Solutions — 0014 order event audit log
--
-- Append-only audit trail for order lifecycle mutations (payment
-- verification, rejections, status advances, cancellations). Each row
-- records who acted (admin auth user id, never customer PII beyond the
-- order itself), what changed, and when. Read side for the admin order
-- detail page; no UPDATE/DELETE policies exist by design.

create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null
    references public.orders (id) on delete cascade,
  actor_user_id uuid,
  action text not null check (char_length(action) between 1 and 60),
  from_status text,
  to_status text,
  note text,
  created_at timestamptz not null default now()
);

create index order_events_order_idx on public.order_events (order_id, created_at desc);

alter table public.order_events enable row level security;

-- Admins read; authenticated admins write (server APIs after
-- requireAdmin). No update/delete policies exist by design: history
-- is immutable.

create policy order_events_admin_read
  on public.order_events for select
  to authenticated
  using (public.is_admin());

create policy order_events_admin_insert
  on public.order_events for insert
  to authenticated
  with check (public.is_admin());

grant select, insert on public.order_events to authenticated;
