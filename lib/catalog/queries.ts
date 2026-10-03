/**
 * Server-side catalogue reads (Server Components / Route Handlers only).
 *
 * - Active products only — inactive rows never reach the UI.
 * - Minimal column sets and LIMITs; no full-table scans from the UI.
 * - Resilient: Supabase unlinked/unreachable → static dev-data fallback
 *   (mirrors seed.sql); live-but-empty → empty array so pages render
 *   their EmptyState instead of stale data.
 *
 * The Supabase client is imported dynamically so a missing/broken
 * configuration degrades to the fallback instead of crashing the page.
 * Never import this module from Client Components.
 */
import { cache } from "react";
import {
  ALL_PRODUCTS,
  FEATURED_PRODUCTS,
  PRODUCT_CATEGORIES,
  groupByCategory,
  type CatalogProduct,
  type CatalogueParams,
  type ProductCategory,
} from "@/lib/catalog/products";

const PRODUCT_COLUMNS =
  "id,name,slug,description,category,specifications,price,stock_quantity,images,is_active";
const FEATURED_LIMIT = 4;

type ServerClient = Awaited<
  ReturnType<typeof import("@/lib/supabase/server").createClient>
>;

async function getServerClient(): Promise<ServerClient | null> {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    return await createClient();
  } catch {
    return null;
  }
}

function toCatalog(rows: unknown): CatalogProduct[] {
  return (rows ?? []) as unknown as CatalogProduct[];
}

/** Newest active products, capped (homepage featured grid). */
export async function getFeaturedProducts(): Promise<CatalogProduct[]> {
  const supabase = await getServerClient();
  if (!supabase) return FEATURED_PRODUCTS;
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(FEATURED_LIMIT);
  if (error) {
    console.error("[catalog] featured query failed:", error.message);
    return FEATURED_PRODUCTS;
  }
  const rows = toCatalog(data);
  return rows.length > 0 ? rows : [];
}

/** Single active product by slug (detail page). Null when missing/inactive. */
export async function getProductBySlug(
  slug: string,
): Promise<CatalogProduct | null> {
  const supabase = await getServerClient();
  if (!supabase) {
    return ALL_PRODUCTS.find((p) => p.slug === slug) ?? null;
  }
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (error) {
    console.error("[catalog] product query failed:", error.message);
    return ALL_PRODUCTS.find((p) => p.slug === slug) ?? null;
  }
  return (data as unknown as CatalogProduct | null) ?? null;
}

/**
 * Active product slugs (detail-page generateStaticParams).
 * Build-time safe: falls back to static slugs when Supabase is
 * unlinked so `next build` never requires a live database.
 */
export async function getProductSlugs(): Promise<string[]> {
  const supabase = await getServerClient();
  if (!supabase) return ALL_PRODUCTS.map((p) => p.slug);
  const { data, error } = await supabase
    .from("products")
    .select("slug")
    .eq("is_active", true);
  if (error) {
    console.error("[catalog] slugs query failed:", error.message);
    return ALL_PRODUCTS.map((p) => p.slug);
  }
  const rows = (data ?? []) as unknown as Array<{ slug: string }>;
  return rows.map((r) => r.slug);
}

export interface CatalogueResult {
  products: CatalogProduct[];
  categories: ProductCategory[];
  /** Resolved category, or null for "All". */
  activeCategory: ProductCategory | null;
  /** True when ?category= matches nothing (renders empty state). */
  unknownCategory: boolean;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  /** False when served from the static dev-data fallback. */
  live: boolean;
}

function paginate(
  all: CatalogProduct[],
  page: number,
  pageSize: number,
): { products: CatalogProduct[]; total: number; totalPages: number } {
  const total = all.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  return {
    products: all.slice(start, start + pageSize),
    total,
    totalPages,
  };
}

/**
 * Related products: same category, active only, excluding the current
 * product (limit 4). Static fallback offline; [] when nothing qualifies.
 */
export async function getRelatedProducts(
  category: string,
  excludeId: string,
  limit = 4,
): Promise<CatalogProduct[]> {
  const pick = (pool: CatalogProduct[]) =>
    pool.filter((p) => p.category === category && p.id !== excludeId).slice(0, limit);
  const supabase = await getServerClient();
  if (!supabase) return pick(ALL_PRODUCTS.filter((p) => p.is_active));
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("is_active", true)
    .eq("category", category)
    .neq("id", excludeId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[catalog] related query failed:", error.message);
    return pick(ALL_PRODUCTS.filter((p) => p.is_active));
  }
  return toCatalog(data);
}

/**
 * Live category cards with counts; [] when the live catalogue is empty.
 *
 * Cached per request: the listing page's generateMetadata and component
 * share a single categories query instead of firing it twice. Defined
 * above its callers (const arrow functions are not hoisted).
 */
export const getCategories = cache(
  async (): Promise<ProductCategory[]> => {
    const supabase = await getServerClient();
    if (!supabase) return PRODUCT_CATEGORIES;
    const { data, error } = await supabase
      .from("products")
      .select("category")
      .eq("is_active", true);
    if (error) {
      console.error("[catalog] categories query failed:", error.message);
      return PRODUCT_CATEGORIES;
    }
    const rows = (data ?? []) as unknown as Array<{ category: string }>;
    if (rows.length === 0) return [];
    return groupByCategory(rows);
  },
);

/**
 * Paginated, category-filtered catalogue. Two narrow queries (categories
 * for slug→name resolution, then a counted + ranged product query) —
 * never a full-table pull. Static fallback mirrors the same semantics
 * offline; unknown slugs yield an empty page, not an error.
 */
export async function getCataloguePage(
  filters: CatalogueParams,
): Promise<CatalogueResult> {
  const { categorySlug, page, pageSize } = filters;
  const supabase = await getServerClient();
  const staticActive = ALL_PRODUCTS.filter((p) => p.is_active);

  const empty = (
    categories: ProductCategory[],
    unknownCategory: boolean,
    live: boolean,
  ): CatalogueResult => ({
    products: [],
    categories,
    activeCategory: null,
    unknownCategory,
    total: 0,
    page,
    pageSize,
    totalPages: 0,
    live,
  });

  // 1. Categories (slug→name resolution). Shared with generateMetadata
  // through the cached getCategories(): one query per request.
  // Offline → static dev data; live error → static nav (logged);
  // live empty → [] (empty states).
  let categories: ProductCategory[];
  if (!supabase) {
    const grouped = groupByCategory(
      staticActive.map((p) => ({ category: p.category })),
    );
    categories = grouped.length > 0 ? grouped : PRODUCT_CATEGORIES;
  } else {
    categories = await getCategories();
  }

  // 2. Resolve ?category=. Unknown slugs yield an empty page, not an error.
  const activeCategory = categorySlug
    ? (categories.find((c) => c.slug === categorySlug) ?? null)
    : null;
  if (categorySlug && !activeCategory) {
    return empty(categories, true, supabase !== null);
  }

  // 3. Products: static slice offline, counted+ranged query live.
  if (!supabase) {
    return pageOf(
      categories,
      activeCategory,
      staticActive.filter(
        (p) => !activeCategory || p.category === activeCategory.name,
      ),
      false,
    );
  }
  const ranged = await queryLiveRange(
    supabase,
    activeCategory?.name ?? null,
    page,
    pageSize,
  );
  if (!ranged) {
    return pageOf(
      categories,
      activeCategory,
      staticActive.filter(
        (p) => !activeCategory || p.category === activeCategory.name,
      ),
      false,
    );
  }
  return {
    products: ranged.products,
    categories,
    activeCategory,
    unknownCategory: false,
    total: ranged.total,
    page,
    pageSize,
    totalPages: ranged.total === 0 ? 0 : Math.ceil(ranged.total / pageSize),
    live: true,
  };

  function pageOf(
    cats: ProductCategory[],
    active: ProductCategory | null,
    matching: CatalogProduct[],
    isLive: boolean,
  ): CatalogueResult {
    const { products, total, totalPages } = paginate(matching, page, pageSize);
    return {
      products,
      categories: cats,
      activeCategory: active,
      unknownCategory: false,
      total,
      page,
      pageSize,
      totalPages,
      live: isLive,
    };
  }
}

/**
 * One counted + ranged product query. Null on error (caller falls back
 * to static data); never pulls more than one page of rows.
 */
async function queryLiveRange(
  supabase: NonNullable<Awaited<ReturnType<typeof getServerClient>>>,
  categoryName: string | null,
  page: number,
  pageSize: number,
): Promise<{ products: CatalogProduct[]; total: number } | null> {
  let query = supabase
    .from("products")
    .select(PRODUCT_COLUMNS, { count: "exact" })
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (categoryName) query = query.eq("category", categoryName);
  const from = (page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) {
    console.error("[catalog] catalogue page failed:", error.message);
    return null;
  }
  return { products: toCatalog(data), total: count ?? 0 };
}
