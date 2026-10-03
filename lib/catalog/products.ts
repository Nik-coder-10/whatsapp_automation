/**
 * Catalogue data structures shared by the homepage and the product
 * pages. Shapes mirror public.products rows.
 *
 * Static lists below mirror supabase/seed/seed.sql and are used ONLY as
 * an offline fallback (Supabase unlinked / unreachable). Live data from
 * lib/catalog/queries.ts always wins when available — components consume
 * the same CatalogProduct type either way.
 */
import type { Json, ProductRow } from "@/types/database";

export type CatalogProduct = Pick<
  ProductRow,
  | "id"
  | "name"
  | "slug"
  | "description"
  | "category"
  | "specifications"
  | "price"
  | "stock_quantity"
  | "images"
  | "is_active"
>;

export interface ProductCategory {
  slug: string;
  name: string;
  blurb: string;
  productCount: number;
}

const CATEGORY_BLURBS: Record<string, string> = {
  "Pallet Handling": "Hand pallet trucks and stackers for docks and godowns.",
  "Lifting & Stacking": "Scissor tables, chain blocks and stackers.",
  Trolleys: "Shop-floor trolleys built for daily abuse.",
  "Drum Handling": "Safe 210-litre drum movers and handlers.",
  "Dock Equipment": "Levelers and dock accessories.",
  "Material Movement": "Tow tractors for large plants.",
};

/** Editorial fallback when Supabase is unreachable (counts are static). */
export const PRODUCT_CATEGORIES: ProductCategory[] = [
  { slug: "pallet-handling", name: "Pallet Handling", blurb: CATEGORY_BLURBS["Pallet Handling"] ?? "", productCount: 1 },
  { slug: "lifting-stacking", name: "Lifting & Stacking", blurb: CATEGORY_BLURBS["Lifting & Stacking"] ?? "", productCount: 3 },
  { slug: "trolleys", name: "Trolleys", blurb: CATEGORY_BLURBS["Trolleys"] ?? "", productCount: 1 },
  { slug: "drum-handling", name: "Drum Handling", blurb: CATEGORY_BLURBS["Drum Handling"] ?? "", productCount: 1 },
  { slug: "dock-equipment", name: "Dock Equipment", blurb: CATEGORY_BLURBS["Dock Equipment"] ?? "", productCount: 1 },
  { slug: "material-movement", name: "Material Movement", blurb: CATEGORY_BLURBS["Material Movement"] ?? "", productCount: 1 },
];

/** All seed products (dev-data fallback). Prices are NUMERIC decimal strings. */
export const ALL_PRODUCTS: CatalogProduct[] = [
  {
    id: "b1c2d3e4-0001-4000-8000-000000000001",
    name: "Hydraulic Hand Pallet Truck 2500 kg",
    slug: "hydraulic-hand-pallet-truck-2500kg",
    description:
      "Heavy-duty hydraulic hand pallet truck for warehouses and loading bays.",
    category: "Pallet Handling",
    specifications: { capacity_kg: 2500, fork_length_mm: 1150 },
    price: "24999.00",
    stock_quantity: 42,
    images: [],
    is_active: true,
  },
  {
    id: "b1c2d3e4-0002-4000-8000-000000000002",
    name: "Electric Pallet Stacker 1500 kg",
    slug: "electric-pallet-stacker-1500kg",
    description:
      "Battery-operated stacker with 3 m lift height for racking and truck loading.",
    category: "Lifting & Stacking",
    specifications: { capacity_kg: 1500, lift_height_m: 3.0 },
    price: "285000.00",
    stock_quantity: 8,
    images: [],
    is_active: true,
  },
  {
    id: "b1c2d3e4-0003-4000-8000-000000000003",
    name: "Hydraulic Scissor Lift Table 1000 kg",
    slug: "hydraulic-scissor-lift-table-1000kg",
    description:
      "Mobile scissor lift table for ergonomic loading at assembly lines.",
    category: "Lifting & Stacking",
    specifications: { capacity_kg: 1000, lift_height_mm: 1000 },
    price: "78500.00",
    stock_quantity: 15,
    images: [],
    is_active: true,
  },
  {
    id: "b1c2d3e4-0004-4000-8000-000000000004",
    name: "Heavy-Duty Platform Trolley 500 kg",
    slug: "heavy-duty-platform-trolley-500kg",
    description:
      "Steel-deck platform trolley with foldable handle for shop floors.",
    category: "Trolleys",
    specifications: { capacity_kg: 500 },
    price: "6299.00",
    stock_quantity: 120,
    images: [],
    is_active: true,
  },
  {
    id: "b1c2d3e4-0005-4000-8000-000000000005",
    name: "Oil Drum Handler Trolley",
    slug: "oil-drum-handler-trolley",
    description:
      "Four-wheel drum handler for 210-litre MS and plastic drums.",
    category: "Drum Handling",
    specifications: { drum_litres: 210, capacity_kg: 350 },
    price: "12750.00",
    stock_quantity: 30,
    images: [],
    is_active: true,
  },
  {
    id: "b1c2d3e4-0006-4000-8000-000000000006",
    name: "Manual Chain Pulley Block 2 Tonne",
    slug: "manual-chain-pulley-block-2t",
    description:
      "2-tonne chain pulley block with 3 m standard lift for workshops.",
    category: "Lifting & Stacking",
    specifications: { capacity_t: 2, lift_height_m: 3 },
    price: "8999.00",
    stock_quantity: 55,
    images: [],
    is_active: true,
  },
  {
    id: "b1c2d3e4-0007-4000-8000-000000000007",
    name: "Hydraulic Dock Leveler 6 Tonne",
    slug: "hydraulic-dock-leveler-6t",
    description:
      "Pit-mounted hydraulic dock leveler bridging dock and truck bed.",
    category: "Dock Equipment",
    specifications: { capacity_t: 6 },
    price: "145000.00",
    stock_quantity: 5,
    images: [],
    is_active: true,
  },
  {
    id: "b1c2d3e4-0008-4000-8000-000000000008",
    name: "Electric Tow Tractor 3 Tonne",
    slug: "electric-tow-tractor-3t",
    description:
      "Ride-on electric tow tractor for moving trailer trains across plants.",
    category: "Material Movement",
    specifications: { towing_capacity_t: 3 },
    price: "325000.00",
    stock_quantity: 4,
    images: [],
    is_active: true,
  },
];

const FEATURED_IDS = new Set([
  "b1c2d3e4-0001-4000-8000-000000000001",
  "b1c2d3e4-0002-4000-8000-000000000002",
  "b1c2d3e4-0004-4000-8000-000000000004",
  "b1c2d3e4-0007-4000-8000-000000000007",
]);

/** Homepage picks (dev-data fallback). */
export const FEATURED_PRODUCTS: CatalogProduct[] = ALL_PRODUCTS.filter((p) =>
  FEATURED_IDS.has(p.id),
);

export function slugifyCategory(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Groups category rows into display cards with live counts.
 * Pure — unit-tested, reused by getCategories() and fallbacks.
 */
export function groupByCategory(
  rows: Array<{ category: string }>,
): ProductCategory[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.category, (counts.get(row.category) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, productCount]) => ({
      slug: slugifyCategory(name),
      name,
      blurb:
        CATEGORY_BLURBS[name] ??
        `Industrial ${name.toLowerCase()} for plants and warehouses.`,
      productCount,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** NUMERIC decimal string → integer paise (≤2dp, so exact). */
export function priceToPaise(price: string): number {
  return Math.round(Number(price) * 100);
}

export interface SpecEntry {
  label: string;
  value: string;
}

/**
 * Structured specifications → display rows. Top-level entries only;
 * nested objects render as compact JSON (never raw dumps in the UI).
 * Pure — unit-tested.
 */
export function formatSpecEntries(specs: Json): SpecEntry[] {
  if (specs === null || typeof specs !== "object" || Array.isArray(specs)) {
    return [];
  }
  return Object.entries(specs).map(([key, value]) => ({
    label: key.replace(/_/g, " "),
    value:
      typeof value === "object" && value !== null
        ? JSON.stringify(value)
        : String(value),
  }));
}

export const CATALOGUE_DEFAULT_PAGE_SIZE = 12;
export const CATALOGUE_MAX_PAGE_SIZE = 48;

export type CatalogueSort =
  | "relevance"
  | "featured"
  | "price_asc"
  | "price_desc"
  | "name_asc";

export const SORT_OPTIONS: ReadonlyArray<{ value: CatalogueSort; label: string }> = [
  { value: "relevance", label: "Best match" },
  { value: "featured", label: "Featured" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "name_asc", label: "Name: A to Z" },
];

const SORT_VALUES: ReadonlySet<string> = new Set(
  SORT_OPTIONS.map((o) => o.value),
);

export function isCatalogueSort(v: string): v is CatalogueSort {
  return SORT_VALUES.has(v);
}

export interface CatalogueParams {
  /** Category slug from the URL (validated against live categories). */
  categorySlug?: string;
  /** Search text (max 100 chars, trimmed). */
  q?: string;
  /** Defaults to "featured" (newest first). */
  sort?: CatalogueSort;
  /** Rupee bounds (undefined = unbounded). */
  minPrice?: number;
  maxPrice?: number;
  /** Set when both bounds are valid but min > max (range ignored). */
  priceError?: string;
  page: number;
  pageSize: number;
}

/**
 * Parses listing URL params defensively. Pure — unit-tested.
 * Unknown/blank category passes through; the query layer resolves it
 * against live categories (unknown → empty result, not an error).
 * Search (`q`) slots in here in the next phase without touching callers.
 */
export function parseCatalogueParams(
  searchParams: Record<string, string | string[] | undefined>,
): CatalogueParams {
  const first = (v: string | string[] | undefined): string | undefined =>
    Array.isArray(v) ? v[0] : v;

  const rawCategory = (first(searchParams["category"]) ?? "").trim();
  const rawQ = (first(searchParams["q"]) ?? "").trim().slice(0, 100);
  const rawSort = (first(searchParams["sort"]) ?? "").trim();
  const rawPage = Number(first(searchParams["page"]));
  const rawSize = Number(first(searchParams["pageSize"]));
  const rawMin = Number(first(searchParams["min"]));
  const rawMax = Number(first(searchParams["max"]));

  const page =
    Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1;
  const size = Number.isInteger(rawSize) ? rawSize : CATALOGUE_DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(
    CATALOGUE_MAX_PAGE_SIZE,
    Math.max(1, size),
  );
  const minPrice =
    Number.isFinite(rawMin) && rawMin >= 0 ? rawMin : undefined;
  const maxPrice =
    Number.isFinite(rawMax) && rawMax >= 0 ? rawMax : undefined;
  const priceError =
    minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice
      ? "Minimum price is higher than maximum price — the price filter was ignored."
      : undefined;
  const sort: CatalogueSort = isCatalogueSort(rawSort)
    ? rawSort
    : rawQ === ""
      ? "featured"
      : "relevance";

  return {
    ...(rawCategory === "" ? {} : { categorySlug: rawCategory }),
    ...(rawQ === "" ? {} : { q: rawQ }),
    sort,
    ...(minPrice === undefined || priceError ? {} : { minPrice }),
    ...(maxPrice === undefined || priceError ? {} : { maxPrice }),
    ...(priceError ? { priceError } : {}),
    page,
    pageSize,
  };
}

/** Canonical listing URL for a filter set (defaults omitted). */
export function buildCatalogueHref(args: {
  categorySlug?: string;
  q?: string;
  sort?: CatalogueSort;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
}): string {
  const params = new URLSearchParams();
  if (args.q) params.set("q", args.q);
  if (args.categorySlug) params.set("category", args.categorySlug);
  if (args.sort && args.sort !== "featured" && !(args.sort === "relevance" && !args.q)) {
    params.set("sort", args.sort);
  }
  if (args.minPrice !== undefined) params.set("min", String(args.minPrice));
  if (args.maxPrice !== undefined) params.set("max", String(args.maxPrice));
  if (args.page !== undefined && args.page > 1) params.set("page", String(args.page));
  const qs = params.toString();
  return qs === "" ? "/products" : `/products?${qs}`;
}
