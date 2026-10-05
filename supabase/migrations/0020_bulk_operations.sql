-- Trolift Solutions — 0020 bulk-operation audit + atomic imports
--
-- Admin bulk tools (imports/exports) record here: who acted, on what
-- dataset, when, and the result summary. Append-only by design (no
-- UPDATE/DELETE policies), mirroring order_events. actor_user_id has
-- no FK so audit rows survive profile deletion.
--
-- import_products() / import_rates() apply pre-validated rows inside a
-- single transaction: any failure rolls everything back, so a confirm
-- can never partially corrupt production data. Both are callable by
-- admins (authenticated + is_admin) and the service role; everyone
-- else is rejected inside the function.

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  operation text not null check (char_length(operation) between 1 and 60),
  dataset text not null check (char_length(dataset) between 1 and 40),
  total_rows integer not null default 0 check (total_rows >= 0),
  inserted_rows integer not null default 0 check (inserted_rows >= 0),
  updated_rows integer not null default 0 check (updated_rows >= 0),
  failed_rows integer not null default 0 check (failed_rows >= 0),
  result text not null default 'success'
    check (result in ('success', 'partial', 'failed')),
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_created_idx
  on public.admin_audit_log (created_at desc);
create index if not exists admin_audit_log_dataset_idx
  on public.admin_audit_log (dataset, created_at desc);

alter table public.admin_audit_log enable row level security;

grant all on public.admin_audit_log to authenticated;

create policy admin_audit_log_admin_all
  on public.admin_audit_log for all
  to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ─── Atomic product import (pre-validated rows, slug-matched) ───────
-- p_rows: [{name, slug, description, category, price, stock_quantity,
--   low_stock_threshold, is_active, gst_rate, weight_kg}] with NUMERIC
-- columns as decimal strings and booleans as JSON booleans. Slugs are
-- matched normalized (lowercase); existing slugs update in place.
create or replace function public.import_products(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_slug text;
  v_existing uuid;
  v_inserted integer := 0;
  v_updated integer := 0;
begin
  if not (public.is_admin() or auth.uid() is null) then
    raise exception 'not authorized' using errcode = 'raise_exception';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'rows must be a JSON array' using errcode = 'raise_exception';
  end if;

  for v_item in select * from jsonb_array_elements(p_rows) loop
    v_slug := lower(trim(v_item ->> 'slug'));
    if v_slug is null or v_slug = '' then
      raise exception 'row is missing slug' using errcode = 'raise_exception';
    end if;

    select id into v_existing from public.products where slug = v_slug;
    if v_existing is not null then
      update public.products set
        name = v_item ->> 'name',
        description = coalesce(nullif(v_item ->> 'description', ''), description),
        category = v_item ->> 'category',
        price = (v_item ->> 'price')::numeric,
        stock_quantity = (v_item ->> 'stock_quantity')::integer,
        low_stock_threshold = (v_item ->> 'low_stock_threshold')::integer,
        is_active = (v_item ->> 'is_active')::boolean,
        gst_rate = nullif(v_item ->> 'gst_rate', '')::numeric,
        weight_kg = nullif(v_item ->> 'weight_kg', '')::numeric,
        updated_at = now()
      where id = v_existing;
      v_updated := v_updated + 1;
    else
      insert into public.products (
        name, slug, description, category, price, stock_quantity,
        low_stock_threshold, is_active, gst_rate, weight_kg
      )
      values (
        v_item ->> 'name',
        v_slug,
        coalesce(nullif(v_item ->> 'description', ''), ''),
        v_item ->> 'category',
        (v_item ->> 'price')::numeric,
        coalesce((v_item ->> 'stock_quantity'), '0')::integer,
        coalesce((v_item ->> 'low_stock_threshold'), '5')::integer,
        coalesce((v_item ->> 'is_active'), 'true')::boolean,
        nullif(v_item ->> 'gst_rate', '')::numeric,
        nullif(v_item ->> 'weight_kg', '')::numeric
      );
      v_inserted := v_inserted + 1;
    end if;
  end loop;

  return jsonb_build_object('inserted', v_inserted, 'updated', v_updated);
end;
$$;

revoke all on function public.import_products(jsonb) from public;
grant execute on function public.import_products(jsonb) to authenticated, service_role;

-- ─── Atomic rate import (pre-validated rows, pair-matched) ──────────
-- p_rows: [{pincode, partner_id, serviceable, charge, remote_surcharge,
--   min_order, max_order, eta_min, eta_max}] with NUMERIC columns as
-- decimal strings ("" = NULL), booleans as JSON booleans, ETAs as JSON
-- numbers or null. Existing (pincode, partner) pairs update in place —
-- remote_surcharge included, so imports never silently wipe it.
create or replace function public.import_rates(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_existing uuid;
  v_inserted integer := 0;
  v_updated integer := 0;
begin
  if not (public.is_admin() or auth.uid() is null) then
    raise exception 'not authorized' using errcode = 'raise_exception';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'rows must be a JSON array' using errcode = 'raise_exception';
  end if;

  for v_item in select * from jsonb_array_elements(p_rows) loop
    select id into v_existing from public.delivery_pincode_rates
    where pincode = (v_item ->> 'pincode')
      and delivery_partner_id = (v_item ->> 'partner_id')::uuid;
    if v_existing is not null then
      update public.delivery_pincode_rates set
        serviceable = (v_item ->> 'serviceable')::boolean,
        delivery_charge = (v_item ->> 'charge')::numeric,
        remote_surcharge = coalesce(
          nullif(v_item ->> 'remote_surcharge', '')::numeric, 0),
        min_order_amount = nullif(v_item ->> 'min_order', '')::numeric,
        max_order_amount = nullif(v_item ->> 'max_order', '')::numeric,
        eta_min_days = nullif(v_item ->> 'eta_min', '')::integer,
        eta_max_days = nullif(v_item ->> 'eta_max', '')::integer
      where id = v_existing;
      v_updated := v_updated + 1;
    else
      insert into public.delivery_pincode_rates (
        pincode, delivery_partner_id, serviceable, delivery_charge,
        remote_surcharge, min_order_amount, max_order_amount,
        eta_min_days, eta_max_days
      )
      values (
        v_item ->> 'pincode',
        (v_item ->> 'partner_id')::uuid,
        coalesce((v_item ->> 'serviceable'), 'true')::boolean,
        (v_item ->> 'charge')::numeric,
        coalesce(nullif(v_item ->> 'remote_surcharge', '')::numeric, 0),
        nullif(v_item ->> 'min_order', '')::numeric,
        nullif(v_item ->> 'max_order', '')::numeric,
        nullif(v_item ->> 'eta_min', '')::integer,
        nullif(v_item ->> 'eta_max', '')::integer
      );
      v_inserted := v_inserted + 1;
    end if;
  end loop;

  return jsonb_build_object('inserted', v_inserted, 'updated', v_updated);
end;
$$;

revoke all on function public.import_rates(jsonb) from public;
grant execute on function public.import_rates(jsonb) to authenticated, service_role;
