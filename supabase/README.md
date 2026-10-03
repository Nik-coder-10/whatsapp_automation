# Supabase — Trolift Solutions

## Migrations

| File | Contents |
| ---- | -------- |
| `0001_init_placeholder.sql` | No-op baseline (Prompt 1). |
| `0002_extensions_helpers.sql` | `pgcrypto`, `set_updated_at()` trigger fn, `order_number_seq` + `generate_order_number()` (`TRL-YYYY-NNNNNN`). |
| `0003_identity_catalog.sql` | `profiles`, `customers`, `products`, `delivery_partners`, `delivery_pincode_rates` + indexes + `updated_at` triggers. |
| `0004_orders.sql` | `orders` (auto order number, snapshot totals with `total = subtotal + delivery` CHECK), `order_items` (name/price/line-total snapshots, `line_total = qty × price` CHECK), `payments` (unique UTR where present). |
| `0005_messaging.sql` | `whatsapp_leads`, `whatsapp_messages` (outbound-only log; no secrets in tables). |
| `0006_rls.sql` | Grants + `is_admin()` helper + RLS policies (see below). |
| `0007_hardening.sql` | Missing FK indexes, `TS-YYMMDD-SEQ` order numbers + format CHECK, `order_items` timestamps. |
| `0008_search.sql` | `pg_trgm` + trigram index + `search_products()` RPC (ILIKE recall, similarity ranking, price/category windows, clamped pagination). |

`is_admin()` lives in `0006` deliberately: SQL-language function bodies
are validated at `CREATE` time, so it must be defined after `profiles`
exists (a real failure caught during local validation).

Order numbers are display-only (`TS-261001-0001` form: `TS-` + YYMMDD +
a zero-padded global sequence, enforced by
`orders_number_format_check`). UUIDs are the primary keys. The sequence
is global (never reset daily) so concurrent checkouts cannot collide.

No customer authentication exists yet by design: orders, payments and
WhatsApp data are admin + service-role only. When customer accounts
arrive, link `customers` to `auth.users` and add own-order RLS
policies — the `customer_id` FKs are already in place for that.

## Money & snapshots

- All money is `NUMERIC(12,2)` rupees — never float. App code works in
  integer paise and converts at the boundary.
- Orders snapshot `subtotal / delivery_charge / total_amount`, the GSTIN
  and the partner name; items snapshot product name + unit price.
- DB CHECKs enforce `total_amount = subtotal + delivery_charge` and
  `line_total = quantity * unit_price`, so history cannot drift when
  catalogue prices change.

## Access model (RLS)

- `anon, authenticated`: `SELECT` active `products`, active
  `delivery_partners`, all `delivery_pincode_rates` (storefront +
  serviceability checks need these).
- `authenticated` + `profiles.is_admin`: full access everywhere.
- Everything else (customers, orders, items, payments, WhatsApp):
  admins + service-role key only. The service role bypasses RLS and is
  used by server Route Handlers.
- `profiles.is_admin` has no public write policy — flip only via the
  service-role key.

## Seed

`seed/seed.sql` is deterministic (fixed UUIDs) and idempotent
(`ON CONFLICT DO NOTHING`): 5 fictional delivery partners, 8 realistic
products, 16 pincode-rate rows across 7 pincodes — including
multi-partner pincodes with different charges, a minimum-order freight
row, and non-serviceable scenarios (`600001` × BlueDart, remote
`799001`).

## Applying

Against a linked project (Supabase CLI unblocked):

```bash
supabase db push        # applies supabase/migrations in order
psql "$SUPABASE_DB_URL" -f supabase/seed/seed.sql   # dev data only
supabase gen types typescript --linked > types/database-generated.ts
```

Validated locally on PostgreSQL 16 (docker): full ordered apply +
30+ behavioural checks (constraint rejections, snapshot immutability,
RESTRICT/CASCADE, trigger firing, anon/authenticated RLS behaviour).
