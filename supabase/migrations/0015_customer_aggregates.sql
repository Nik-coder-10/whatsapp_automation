-- Trolift Solutions — 0015 admin customer aggregates
--
-- Single-call customer list + detail for the admin UI (no N+1, no
-- full-table pulls into the browser). All money stays NUMERIC;
-- historical order values come from stored snapshots only — current
-- product prices are never consulted here.
--
-- SECURITY DEFINER but self-guarding: both functions refuse non-admins
-- via public.is_admin(). Projections exclude nothing sensitive for
-- admins (customer PII is their working data), but callers must keep
-- these admin-only: no public grants are issued.

-- Escape LIKE metacharacters so search text stays literal.
create or replace function public.admin_search_pattern(p_search text)
returns text
language sql
immutable
as $$ select '%' || replace(replace(replace(p_search, '\', '\\'), '%', '\%'), '_', '\_') || '%' $$;

create or replace function public.get_admin_customers(
  p_search text default null,
  p_sort text default 'newest',
  p_limit integer default 15,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_pattern text := case when p_search is null or p_search = '' then null
    else public.admin_search_pattern(p_search) end;
  v_limit integer := least(greatest(coalesce(p_limit, 15), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_total bigint;
  v_rows jsonb;
begin
  if not public.is_admin() then
    raise exception 'admin access required' using errcode = 'insufficient_privilege';
  end if;

  select count(*) into v_total
  from public.customers c
  where v_pattern is null
    or c.name ilike v_pattern
    or c.phone ilike v_pattern
    or coalesce(c.email, '') ilike v_pattern
    or coalesce(c.gstin, '') ilike v_pattern;

  select coalesce(jsonb_agg(t), '[]'::jsonb) into v_rows
  from (
    select jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'phone', c.phone,
      'email', c.email,
      'gstin', c.gstin,
      'created_at', c.created_at,
      'order_count', count(o.id),
      'paid_count', count(*) filter (where o.payment_status = 'paid'),
      'paid_total', coalesce(sum(o.total_amount) filter (where o.payment_status = 'paid'), 0),
      'latest_order_at', max(o.created_at)
    ) as t
    from public.customers c
    left join public.orders o on o.customer_id = c.id
    where (v_pattern is null
      or c.name ilike v_pattern
      or c.phone ilike v_pattern
      or coalesce(c.email, '') ilike v_pattern
      or coalesce(c.gstin, '') ilike v_pattern)
    group by c.id, c.name, c.phone, c.email, c.gstin, c.created_at
    order by
      case when p_sort = 'oldest' then c.created_at end asc,
      case when p_sort = 'orders_desc' then count(o.id) end desc,
      case when p_sort = 'paid_desc' then coalesce(sum(o.total_amount) filter (where o.payment_status = 'paid'), 0) end desc,
      case when p_sort = 'name_asc' then c.name end asc,
      c.created_at desc
    limit v_limit offset v_offset
  ) t;

  return jsonb_build_object('total', v_total, 'customers', v_rows);
end;
$$;

create or replace function public.get_admin_customer(p_customer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_profile jsonb;
  v_summary jsonb;
  v_orders jsonb;
begin
  if not public.is_admin() then
    raise exception 'admin access required' using errcode = 'insufficient_privilege';
  end if;

  select jsonb_build_object(
    'id', c.id,
    'name', c.name,
    'phone', c.phone,
    'email', c.email,
    'gstin', c.gstin,
    'created_at', c.created_at
  ) into v_profile
  from public.customers c
  where c.id = p_customer_id;
  if v_profile is null then
    return null;
  end if;

  select jsonb_build_object(
    'order_count', count(o.id),
    'paid_count', count(*) filter (where o.payment_status = 'paid'),
    'cancelled_count', count(*) filter (where o.order_status = 'cancelled'),
    'paid_total', coalesce(sum(o.total_amount) filter (where o.payment_status = 'paid'), 0),
    'first_order_at', min(o.created_at),
    'latest_order_at', max(o.created_at)
  ) into v_summary
  from public.orders o
  where o.customer_id = p_customer_id;

  select coalesce(jsonb_agg(t), '[]'::jsonb) into v_orders
  from (
    select jsonb_build_object(
      'order_id', o.id,
      'order_number', o.order_number,
      'total_amount', o.total_amount,
      'payment_status', o.payment_status,
      'order_status', o.order_status,
      'created_at', o.created_at
    ) as t
    from public.orders o
    where o.customer_id = p_customer_id
    order by o.created_at desc
    limit 20
  ) t;

  return jsonb_build_object(
    'customer', v_profile,
    'summary', v_summary,
    'orders', v_orders
  );
end;
$$;

revoke all on function public.admin_search_pattern(text) from public;
revoke all on function public.get_admin_customers(text, text, integer, integer) from public;
revoke all on function public.get_admin_customer(uuid) from public;
grant execute on function public.admin_search_pattern(text) to authenticated;
grant execute on function public.get_admin_customers(text, text, integer, integer) to authenticated;
grant execute on function public.get_admin_customer(uuid) to authenticated;
