import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { EmptyState } from "@/components/ui/States";
import { CategoryFilter } from "@/components/products/CategoryFilter";
import { Pagination } from "@/components/products/Pagination";
import { ProductGrid } from "@/components/products/ProductGrid";
import { getCataloguePage } from "@/lib/catalog/queries";
import { parseCatalogueParams } from "@/lib/catalog/products";

type SearchParams = Record<string, string | string[] | undefined>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const params = parseCatalogueParams(await searchParams);
  const result = await getCataloguePage({ ...params, pageSize: 1, page: 1 });
  const suffix = result.activeCategory ? ` — ${result.activeCategory.name}` : "";
  return {
    title: `Products${suffix}`,
    description:
      `Browse Trolift industrial equipment${suffix} with transparent ex-GST ` +
      `pricing, stock availability and GST invoicing.`,
  };
}

/**
 * Public catalogue: server-rendered grid with DB-driven category pills
 * and page navigation. Active products only; loading/empty/error states
 * via loading.tsx / EmptyState / error.tsx.
 */
export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = parseCatalogueParams(await searchParams);
  const result = await getCataloguePage(params);
  const heading = result.activeCategory
    ? result.activeCategory.name
    : "All products";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <Breadcrumbs
        items={
          result.activeCategory
            ? [
                { label: "Home", href: "/" },
                { label: "Products", href: "/products" },
                { label: result.activeCategory.name },
              ]
            : [{ label: "Home", href: "/" }, { label: "Products" }]
        }
      />
      <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-bold tracking-[0.14em] text-brand-700 uppercase">
            Catalogue
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-zinc-900 sm:text-3xl">
            {heading}
          </h1>
          <p role="status" className="mt-1 text-sm text-zinc-600">
            {result.unknownCategory
              ? "Unknown category."
              : result.total === 0
                ? "No products available right now."
                : `${result.total} ${result.total === 1 ? "product" : "products"} · prices excl. GST`}
          </p>
        </div>
      </div>

      <div className="mt-5">
        <CategoryFilter
          categories={result.categories}
          activeSlug={result.activeCategory?.slug}
          total={result.categories.reduce((n, c) => n + c.productCount, 0)}
        />
      </div>

      <div className="mt-6">
        {result.unknownCategory ? (
          <EmptyState
            title="Unknown category"
            message="That category does not exist. Browse all products instead."
          />
        ) : result.products.length === 0 ? (
          <EmptyState
            title={
              result.page > 1
                ? "No products on this page"
                : "No products available"
            }
            message={
              result.page > 1
                ? "Try an earlier page, or contact sales for availability."
                : "Our catalogue is being stocked. Contact sales for current availability and quotes."
            }
          />
        ) : (
          <ProductGrid products={result.products} />
        )}
      </div>

      {result.products.length > 0 && (
        <div className="mt-8">
          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            categorySlug={result.activeCategory?.slug}
          />
        </div>
      )}

      <p className="mt-6 text-sm text-zinc-500">
        Need something specific?{" "}
        <Link href="/#contact" className="font-semibold text-brand-700 hover:underline">
          Ask sales for a quote
        </Link>
        .
      </p>
    </div>
  );
}
