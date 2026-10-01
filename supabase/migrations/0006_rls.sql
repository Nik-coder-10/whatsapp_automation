-- Trolift Solutions — 0006 row-level security
--
-- Access model:
--   * Storefront (anon + authenticated): read ACTIVE products, active
--     delivery partners and pincode rates (needed for browsing +
--     serviceability checks). Nothing else.
--   * Admins (authenticated users with profiles.is_admin): full access to
--     every table via public.is_admin().
--   * Server (service-role key): bypasses RLS; used by Route Handlers for
--     order placement, payment reconciliation and WhatsApp dispatch.
-- Customers, orders, payments and WhatsApp data have NO public policies:
-- RLS denies them to everyone except admins and the service role.

alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.delivery_partners enable row level security;
alter table public.delivery_pincode_rates enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.whatsapp_leads enable row level security;
alter table public.whatsapp_messages enable row level security;

-- ─── Grants (RLS policies alone grant nothing) ────────────────────────
-- Storefront reads for everyone; full DML for authenticated admins
-- (further gated by the is_admin() policies below). The service-role
-- key bypasses both grants and RLS.
grant usage on schema public to anon, authenticated;

grant select on public.products to anon, authenticated;
grant select on public.delivery_partners to anon, authenticated;
grant select on public.delivery_pincode_rates to anon, authenticated;

grant all on public.profiles to authenticated;
grant all on public.customers to authenticated;
grant all on public.products to authenticated;
grant all on public.delivery_partners to authenticated;
grant all on public.delivery_pincode_rates to authenticated;
grant all on public.orders to authenticated;
grant all on public.order_items to authenticated;
grant all on public.payments to authenticated;
grant all on public.whatsapp_leads to authenticated;
grant all on public.whatsapp_messages to authenticated;

-- Order numbers auto-assign inside a trigger; inserting roles need
-- sequence access (service role bypasses, admins do not).
grant usage, select on sequence public.order_number_seq to authenticated;

-- ─── Admin-check helper ───────────────────────────────────────────────
-- Defined here (after profiles exists): SQL-language bodies are
-- validated at CREATE time. SECURITY DEFINER so policies can read
-- profiles without recursion. No public UPDATE policy exists, so
-- is_admin can only be flipped via the service-role key.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_admin = true
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ─── profiles: users read their own row ───────────────────────────────
create policy profiles_self_read
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

-- ─── Storefront reads ─────────────────────────────────────────────────
create policy products_public_read
  on public.products for select
  to anon, authenticated
  using (is_active = true);

create policy partners_public_read
  on public.delivery_partners for select
  to anon, authenticated
  using (is_active = true);

create policy rates_public_read
  on public.delivery_pincode_rates for select
  to anon, authenticated
  using (true);

-- ─── Admin full access (authenticated + is_admin) ─────────────────────
create policy profiles_admin_all
  on public.profiles for all
  to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy customers_admin_all
  on public.customers for all
  to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy products_admin_all
  on public.products for all
  to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy partners_admin_all
  on public.delivery_partners for all
  to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy rates_admin_all
  on public.delivery_pincode_rates for all
  to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy orders_admin_all
  on public.orders for all
  to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy order_items_admin_all
  on public.order_items for all
  to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy payments_admin_all
  on public.payments for all
  to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy whatsapp_leads_admin_all
  on public.whatsapp_leads for all
  to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy whatsapp_messages_admin_all
  on public.whatsapp_messages for all
  to authenticated
  using (public.is_admin()) with check (public.is_admin());
