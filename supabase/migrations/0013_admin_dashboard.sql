-- Trolift Solutions — 0013 admin dashboard aggregates
--
-- Single-call dashboard data: status counts, paid revenue and the
-- latest payment claims + recent orders (with customer names only —
-- no phones, emails or GSTINs leave the database here).
--
-- SECURITY DEFINER but self-guarding: it refuses non-admins via
-- public.is_admin(), so the anon/authenticated execute grant cannot
-- leak anything. All money stays NUMERIC; the app converts to paise.
-- p_days: null = all time, otherwise the trailing N days.

create or replace function public.get_admin_dashboard(p_days integer default null)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_from timestamptz := case
    when p_days is null or p_days < 0 then null
    else now() - (least(p_days, 3650) || ' days')::interval
  end;
  v_counts jsonb;
  v_revenue numeric(12, 2);
  v_claims jsonb;
  v_recent jsonb;
begin
  if not public.is_admin() then
    raise exception 'admin access required' using errcode = 'insufficient_privilege';
  end if;

  select coalesce(jsonb_object_agg(order_status, cnt), '{}'::jsonb)
  into v_counts
  from (
    select o.order_status, count(*)::integer as cnt
    from public.orders o
    where v_from is null or o.created_at >= v_from
    group by o.order_status
  ) s;

  select coalesce(sum(o.total_amount), 0)::numeric(12, 2)
  into v_revenue
  from public.orders o
  where o.payment_status = 'paid'
    and (v_from is null or o.created_at >= v_from);

  select coalesce(jsonb_agg(t), '[]'::jsonb)
  into v_claims
  from (
    select jsonb_build_object(
      'order_id', o.id,
      'order_number', o.order_number,
      'amount', p.amount,
      'customer_name', c.name,
      'reference', p.transaction_reference,
      'payment_status', p.status,
      'submitted_at', p.updated_at
    ) as t
    from public.payments p
    join public.orders o on o.id = p.order_id
    join public.customers c on c.id = o.customer_id
    where p.status = 'submitted'
    order by p.updated_at desc
    limit 10
  ) t;

  select coalesce(jsonb_agg(t), '[]'::jsonb)
  into v_recent
  from (
    select jsonb_build_object(
      'order_id', o.id,
      'order_number', o.order_number,
      'customer_name', c.name,
      'total_amount', o.total_amount,
      'payment_status', o.payment_status,
      'order_status', o.order_status,
      'created_at', o.created_at
    ) as t
    from public.orders o
    join public.customers c on c.id = o.customer_id
    where v_from is null or o.created_at >= v_from
    order by o.created_at desc
    limit 10
  ) t;

  return jsonb_build_object(
    'status_counts', v_counts,
    'paid_revenue', v_revenue,
    'claims', v_claims,
    'recent_orders', v_recent
  );
end;
$$;

revoke all on function public.get_admin_dashboard(integer) from public;
grant execute on function public.get_admin_dashboard(integer) to authenticated;
