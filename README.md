# Trolift Solutions — B2B Ordering Platform

Industrial material-handling equipment, ordered simply. A production-oriented
**Next.js + Supabase** foundation for browsing equipment, ordering by pincode,
paying on UPI and tracking orders on WhatsApp — with an admin backend for
products, customers, orders, payments, delivery data and messaging.

> **Status:** foundation complete — database, design system, homepage and
> engineering guardrails are in place. Catalogue, cart, checkout, payment and
> WhatsApp automation land in the next phases.

---

## What is this?

Trolift Solutions sells warehouses and workshops what they run on: hydraulic
pallet trucks, stackers, scissor tables, trolleys, drum handlers, dock
levelers and more. This platform will let B2B customers:

- Browse equipment with transparent, ex-GST pricing
- Check delivery serviceability by pincode *before* paying
- Pay the owner directly over UPI (verified server-side, always)
- Get order confirmations and status updates on WhatsApp automatically

…and let Trolift staff manage everything from an authenticated admin
dashboard.

## Tech stack

| Layer      | Choice                                              |
| ---------- | --------------------------------------------------- |
| Framework  | Next.js 16 (App Router) + React 19 + TypeScript     |
| Styling    | Tailwind CSS v4, industrial navy/amber design system|
| Database   | PostgreSQL via Supabase, UUID keys, RLS everywhere  |
| Auth       | Supabase Auth (`profiles.is_admin` for admin gates) |
| API        | Route Handlers with a standard `{ ok, data\|error }` envelope |
| Tests      | Vitest (29 tests), ESLint, `tsc --noEmit`           |

## Getting started

```bash
cp .env.example .env.local   # fill in real values — never commit secrets
npm install
npm run dev                  # http://localhost:3000
```

| Command           | Purpose                              |
| ----------------- | ------------------------------------ |
| `npm run dev`     | Start the development server         |
| `npm run build`   | Production build                     |
| `npm run lint`    | ESLint                               |
| `npm run typecheck` | Strict TypeScript check            |
| `npm test`        | Vitest unit tests                    |

Health check: `GET /api/health` → `{ ok: true, data: { status: "ok", … } }`.

## Project structure

```text
app/                  routes (homepage, loading/error states) + api/health
components/ui         Button, Input, Select, Card, Badge, Alert, Modal,
                      Dropdown, Toast, Skeleton, Breadcrumbs,
                      QuantitySelector, PriceDisplay, StatusBadge
components/layout     Navbar, Footer, SiteShell + admin shell
components/products   ProductCard (catalogue-ready)
components/home       Hero, CategoryGrid, FeaturedProducts, Trust, Contact
lib/supabase          browser / RLS-server / service-role (server-only) clients
lib/auth              session + admin gates
lib/catalog           catalogue types + featured data (DB-backed later)
lib/validations       pincode / GSTIN / phone / email
lib/delivery          pincode serviceability read (server-side)
lib/orders            integer-paise money helpers (never floats)
lib/payments          owner-UPI config (server-only)
lib/whatsapp          official Cloud API sender (server-only)
supabase/migrations   0001–0007: schema, snapshots, RLS, hardening
supabase/seed         deterministic dev data (partners, products, rates)
types/                domain, API envelope, database rows
tests/                unit tests for validations, pricing, contact config
```

## Database

- **10 tables**: `profiles`, `customers`, `products`, `delivery_partners`,
  `delivery_pincode_rates`, `orders`, `order_items`, `payments`,
  `whatsapp_leads`, `whatsapp_messages`.
- **Money** is `NUMERIC(12,2)`; the app works in integer paise.
- **History is immutable**: orders snapshot totals/GSTIN/partner name, items
  snapshot name/price — DB CHECKs enforce `total = subtotal + delivery` and
  `line_total = qty × price`.
- **Order numbers** are display-only (`TS-YYMMDD-SEQ`, e.g. `TS-261001-0001`);
  UUIDs are the primary keys.
- **RLS**: public reads only active products/partners/rates; orders, payments
  and WhatsApp data are admin + service-role only.

```bash
supabase db push                                     # apply migrations
psql "$SUPABASE_DB_URL" -f supabase/seed/seed.sql    # dev data only
```

## Security model

- Service-role key, WhatsApp tokens and UPI config are **server-only**
  (`server-only` import = build error if ever bundled client-side).
- Prices, charges and totals are **recomputed server-side**; browser values
  are never trusted. No client-side payment verification.
- WhatsApp only via the **official Business Platform API** — no automation
  hacks. Secrets stay in server environment variables, never in tables.

## Roadmap

- [x] Foundation (architecture, conventions, homepage shell)
- [x] Database (schema, RLS, seed, live-Postgres validated)
- [x] Design system (industrial UI kit, responsive homepage)
- [x] Foundation audit (tests, hardening)
- [ ] Product catalogue + product pages
- [ ] Cart + checkout (GSTIN optional, pincode mandatory)
- [ ] UPI payment + server-side verification
- [ ] WhatsApp order notifications
- [ ] Admin dashboard CRUD

---

Built with Next.js, Supabase and TypeScript. GST invoice on every order. 🏭
