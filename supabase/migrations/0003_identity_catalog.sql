-- Trolift Solutions — 0003 identity + catalogue
--
-- profiles (Supabase Auth admins), customers, products, delivery partners
-- and per-partner pincode serviceability / delivery rates.

-- ─── Admin profiles ─────────────────────────────────────────────────────
-- One row per Supabase Auth user. is_admin is flipped ONLY via the
-- service-role key (no public UPDATE policy exists — see 0006_rls.sql).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_email_format
    check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

-- ─── Customers (B2B buyers) ────────────────────────────────────────────
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  phone text not null check (phone ~ '^\+?[0-9]{7,15}$'),
  email text check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  -- Optional GSTIN; validated case-insensitively (app normalises to UPPER).
  gstin text check (
    gstin is null
    or upper(gstin) ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Unique e-mail per customer (multiple NULLs allowed).
create unique index customers_email_unique
  on public.customers (email) where email is not null;
create index customers_phone_idx on public.customers (phone);

-- ─── Products ─────────────────────────────────────────────────────────
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text not null default '',
  category text not null check (char_length(category) between 1 and 100),
  specifications jsonb not null default '{}'::jsonb,
  -- Rupees. NUMERIC, never float. App layer works in integer paise.
  price numeric(12, 2) not null check (price >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  images text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_category_idx on public.products (category);
-- Storefront fast path: active products only.
create index products_active_idx on public.products (id) where is_active = true;

-- ─── Delivery partners ────────────────────────────────────────────────
create table public.delivery_partners (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 150),
  contact_name text,
  contact_phone text check (
    contact_phone is null or contact_phone ~ '^\+?[0-9]{7,15}$'
  ),
  contact_email text check (
    contact_email is null
    or contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  ),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── Pincode serviceability + delivery rates ───────────────────────────
-- One row per (pincode, partner): several partners may serve the same
-- pincode, each with its own charge / ETA / order-size constraints.
create table public.delivery_pincode_rates (
  id uuid primary key default gen_random_uuid(),
  pincode text not null check (pincode ~ '^[1-9][0-9]{5}$'),
  delivery_partner_id uuid not null
    references public.delivery_partners (id) on delete cascade,
  serviceable boolean not null default true,
  -- Rupees. Meaningful only when serviceable; 0 otherwise by convention.
  delivery_charge numeric(12, 2) not null default 0 check (delivery_charge >= 0),
  -- Optional order-size window (NULL = no bound on that side).
  min_order_amount numeric(12, 2) check (
    min_order_amount is null or min_order_amount >= 0
  ),
  max_order_amount numeric(12, 2) check (
    max_order_amount is null or max_order_amount >= 0
  ),
  constraint pincode_rates_order_window_check check (
    min_order_amount is null
    or max_order_amount is null
    or max_order_amount >= min_order_amount
  ),
  -- Optional ETA window in days.
  eta_min_days integer check (eta_min_days is null or eta_min_days between 0 and 60),
  eta_max_days integer check (eta_max_days is null or eta_max_days between 0 and 60),
  constraint pincode_rates_eta_window_check check (
    eta_min_days is null
    or eta_max_days is null
    or eta_max_days >= eta_min_days
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pincode_rates_partner_unique unique (pincode, delivery_partner_id)
);

-- Checkout fast path: all rates for one pincode.
create index pincode_rates_pincode_idx
  on public.delivery_pincode_rates (pincode);

-- ─── updated_at triggers ──────────────────────────────────────────────
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create trigger delivery_partners_set_updated_at
  before update on public.delivery_partners
  for each row execute function public.set_updated_at();

create trigger pincode_rates_set_updated_at
  before update on public.delivery_pincode_rates
  for each row execute function public.set_updated_at();
