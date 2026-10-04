# Trolift Solutions — B2B Ordering Platform

Industrial material-handling equipment, ordered simply. A production-oriented
**Next.js + Supabase** platform for browsing equipment, ordering by pincode
with automated delivery calculation, and paying on UPI — with an admin
backend for products, customers, orders, payments and delivery data.

> **Status:** catalogue, search, product pages and design system live.
> Cart, checkout, payment and admin dashboard land in the next phases.

---

## What is this?

Trolift Solutions sells warehouses and workshops what they run on: hydraulic
pallet trucks, stackers, scissor tables, trolleys, drum handlers, dock
levelers and more. This platform lets B2B customers:

- Browse equipment with transparent, ex-GST pricing
- Search, filter and sort the catalogue to find the right machine
- Check delivery serviceability by pincode *before* paying
- See automated delivery charges per partner
- Pay the owner directly over UPI (verified server-side, always)

…and lets Trolift staff manage everything from an authenticated admin
dashboard.

## Tech stack

| Layer      | Choice                                              |
| ---------- | --------------------------------------------------- |
| Framework  | Next.js 16 (App Router) + React 19 + TypeScript     |
| Styling    | Tailwind CSS v4, industrial navy/amber design system|
| Database   | PostgreSQL via Supabase, UUID keys, RLS everywhere  |
| Search     | `pg_trgm` + `search_products()` RPC (no extra infra)|
| Auth       | Supabase Auth (`profiles.is_admin` for admin gates) |
| API        | Route Handlers with a standard `{ ok, data\|error }` envelope |
| Tests      | Vitest, ESLint, `tsc --noEmit`                      |

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
app/                  homepage, /products listing + /products/[slug],
                      loading/error states + api/health
components/ui         Button, Input, Select, Card, Badge, Alert, Modal,
                      Dropdown, Toast, Skeleton, Breadcrumbs,
                      QuantitySelector, PriceDisplay, StatusBadge
components/layout     Navbar, Footer, SiteShell + admin shell
components/products   ProductCard, ProductGrid, CategoryFilter, FilterBar,
                      Pagination, ProductGallery, RelatedProducts
components/cart       AddToCartControl (cart-phase interface)
components/home       Hero, CategoryGrid, FeaturedProducts, Trust, Contact
lib/supabase          browser / RLS-server / service-role (server-only) clients
lib/auth              session + admin gates
lib/catalog           catalogue types, params, live queries + static fallback
lib/validations       pincode / GSTIN / phone / email
lib/delivery          pincode serviceability read (server-side)
lib/orders            integer-paise money helpers (never floats)
lib/payments          owner-UPI config (server-only)
supabase/migrations   0001–0009: schema, snapshots, RLS, hardening, search,
                      removal of out-of-scope messaging tables
supabase/seed         deterministic dev data (partners, products, rates)
types/                domain, API envelope, database rows
tests/                unit tests for validations, pricing, catalogue
```

## Database

- **8 tables**: `profiles`, `customers`, `products`, `delivery_partners`,
  `delivery_pincode_rates`, `orders`, `order_items`, `payments`.
- **Money** is `NUMERIC(12,2)`; the app works in integer paise.
- **History is immutable**: orders snapshot totals/GSTIN/partner name, items
  snapshot name/price — DB CHECKs enforce `total = subtotal + delivery` and
  `line_total = qty × price`.
- **Order numbers** are display-only (`TS-YYMMDD-SEQ`, e.g. `TS-261001-0001`);
  UUIDs are the primary keys.
- **RLS**: public reads only active products/partners/rates; orders and
  payments are admin + service-role only.

```bash
supabase db push                                     # apply migrations
psql "$SUPABASE_DB_URL" -f supabase/seed/seed.sql    # dev data only
```

## Security model

- Service-role key and UPI config are **server-only**
  (`server-only` import = build error if ever bundled client-side).
- Prices, charges and totals are **recomputed server-side**; browser values
  are never trusted. No client-side payment verification.
- Secrets stay in server environment variables, never in tables.

## Roadmap

- [x] Foundation (architecture, conventions, homepage shell)
- [x] Database (schema, RLS, seed, live-Postgres validated)
- [x] Design system (industrial UI kit, responsive homepage)
- [x] Foundation audit (tests, hardening)
- [x] Product catalogue + product pages + search
- [ ] Cart (GSTIN optional, pincode mandatory)
- [ ] Checkout with pincode serviceability + delivery calculation
- [ ] UPI payment + server-side verification
- [ ] Order management + admin dashboard CRUD

---

Built with Next.js, Supabase and TypeScript. GST invoice on every order. 🏭
