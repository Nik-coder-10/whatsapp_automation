-- Trolift Solutions — 0002 extensions + shared helpers
--
-- Extensions, timestamp trigger, human-readable order numbers and the
-- admin-check helper used by RLS policies. No tables yet.

-- gen_random_uuid() for UUID primary keys.
create extension if not exists "pgcrypto";

-- Keeps updated_at fresh on every UPDATE.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Human-readable order numbers: TRL-2026-000001, …
-- Backed by a sequence so concurrent checkouts never collide.
create sequence if not exists public.order_number_seq;

create or replace function public.generate_order_number()
returns text
language plpgsql
as $$
begin
  return 'TRL-'
    || to_char(now(), 'YYYY')
    || '-'
    || lpad(nextval('public.order_number_seq')::text, 6, '0');
end;
$$;

-- NOTE: public.is_admin() lives in 0006_rls.sql (next to its policies).
-- SQL-language function bodies are validated at CREATE time, so the
-- helper must be defined after public.profiles exists (see 0003).
