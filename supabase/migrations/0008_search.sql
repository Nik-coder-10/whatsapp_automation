-- Trolift Solutions — 0008 product search
--
-- Server-side catalogue search with trigram relevance. No external
-- search infrastructure: pg_trgm (bundled with Postgres / Supabase)
-- ranks matches, ILIKE keeps recall predictable, and a single RPC
-- returns one page of rows plus the total count.
--
-- Recall: name / category / description / slug substring match
-- (LIKE wildcards in the query are escaped, so "100%" is literal).
-- Ranking: trigram similarity of the query against the product
-- document (name + category + description). No threshold cut-off:
-- every ILIKE match is returned, best first.
-- Safety: invoker's rights (RLS still applies), active-only rows,
-- price window optional, limit clamped to 48 server-side.

create extension if not exists pg_trgm;

-- Trigram index over the searchable document for ILIKE + similarity
-- speed as the catalogue grows (currently also serves seq scans fine).
create index if not exists products_search_trgm_idx
  on public.products using gin ((
    coalesce(name, '') || ' ' ||
    coalesce(category, '') || ' ' ||
    coalesce(description, '') || ' ' ||
    coalesce(slug, '')
  ) gin_trgm_ops);

create or replace function public.search_products(
  p_query text,
  p_category text default null,
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_sort text default 'relevance',
  p_limit integer default 12,
  p_offset integer default 0
)
returns table (
  id uuid,
  name text,
  slug text,
  description text,
  category text,
  specifications jsonb,
  price numeric(12, 2),
  stock_quantity integer,
  images text[],
  is_active boolean,
  rank real,
  total_count bigint
)
language plpgsql
stable
set search_path = public
as $$
declare
  -- Escape LIKE metacharacters so user input is always literal.
  v_pattern text :=
    '%' || replace(replace(replace(p_query, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  v_limit integer := least(greatest(coalesce(p_limit, 12), 1), 48);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  return query
  with matched as (
    select
      p.*,
      similarity(
        coalesce(p.name, '') || ' ' ||
        coalesce(p.category, '') || ' ' ||
        coalesce(p.description, ''),
        p_query
      ) as rnk
    from public.products p
    where p.is_active = true
      and (
        p.name ilike v_pattern
        or p.category ilike v_pattern
        or p.description ilike v_pattern
        or p.slug ilike v_pattern
      )
      and (p_category is null or p.category = p_category)
      and (p_min_price is null or p.price >= p_min_price)
      and (p_max_price is null or p.price <= p_max_price)
  )
  select
    m.id, m.name, m.slug, m.description, m.category,
    m.specifications, m.price, m.stock_quantity, m.images, m.is_active,
    m.rnk, count(*) over() as total_count
  from matched m
  order by
    case when p_sort = 'price_asc' then m.price end asc,
    case when p_sort = 'price_desc' then m.price end desc,
    case when p_sort = 'name_asc' then m.name end asc,
    case when p_sort = 'relevance' then m.rnk end desc,
    m.created_at desc
  limit v_limit offset v_offset;
end;
$$;

-- Invoker's rights: RLS policies still apply. Active-only is also
-- enforced in the body as defence in depth.
revoke all on function public.search_products(
  text, text, numeric, numeric, text, integer, integer
) from public;
grant execute on function public.search_products(
  text, text, numeric, numeric, text, integer, integer
) to anon, authenticated;
