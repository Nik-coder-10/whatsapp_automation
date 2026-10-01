-- Trolift Solutions — 0005 WhatsApp leads + message log
--
-- Outbound-only log. Sending stays server-side via the official WhatsApp
-- Business Platform (Cloud API). No tokens or credentials in these tables —
-- only phone numbers, templates, provider IDs and delivery states.

-- ─── WhatsApp leads (pre-order interest) ──────────────────────────────
create table public.whatsapp_leads (
  id uuid primary key default gen_random_uuid(),
  name text check (name is null or char_length(name) between 1 and 200),
  phone text not null check (phone ~ '^\+?[0-9]{7,15}$'),
  email text check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  interested_product_id uuid
    references public.products (id) on delete set null,
  -- Template used + rendered body for audit.
  template_name text,
  message_body text,
  provider_message_id text,
  delivery_status text not null default 'queued'
    check (delivery_status in ('queued', 'sent', 'delivered', 'read', 'failed')),
  error_info text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index whatsapp_leads_phone_idx on public.whatsapp_leads (phone);
create index whatsapp_leads_status_idx on public.whatsapp_leads (delivery_status);
create index whatsapp_leads_product_idx
  on public.whatsapp_leads (interested_product_id);

-- ─── WhatsApp message log (order + ops messages) ──────────────────────
create table public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers (id) on delete set null,
  order_id uuid references public.orders (id) on delete set null,
  phone text not null check (phone ~ '^\+?[0-9]{7,15}$'),
  message_type text not null
    check (message_type in (
      'order_confirmation', 'order_status', 'payment_reminder',
      'lead_followup', 'other'
    )),
  template_name text,
  message_body text,
  provider_message_id text,
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'delivered', 'read', 'failed')),
  error_info text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index whatsapp_messages_customer_idx
  on public.whatsapp_messages (customer_id);
create index whatsapp_messages_order_idx on public.whatsapp_messages (order_id);
create index whatsapp_messages_phone_idx on public.whatsapp_messages (phone);
create index whatsapp_messages_status_idx on public.whatsapp_messages (status);

-- ─── updated_at triggers ──────────────────────────────────────────────
create trigger whatsapp_leads_set_updated_at
  before update on public.whatsapp_leads
  for each row execute function public.set_updated_at();

create trigger whatsapp_messages_set_updated_at
  before update on public.whatsapp_messages
  for each row execute function public.set_updated_at();
