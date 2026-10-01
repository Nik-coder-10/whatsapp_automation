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
import {
  ALL_PRODUCTS,
  FEATURED_PRODUCTS,
  PRODUCT_CATEGORIES,
  groupByCategory,
  type CatalogProduct,
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

/** Live category cards with counts; [] when the live catalogue is empty. */
export async function getCategories(): Promise<ProductCategory[]> {
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
}
