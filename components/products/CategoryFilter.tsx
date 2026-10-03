import Link from "next/link";
import {
  buildCatalogueHref,
  type CatalogueSort,
  type ProductCategory,
} from "@/lib/catalog/products";

export interface FilterQuery {
  q?: string;
  sort?: CatalogueSort;
  minPrice?: number;
  maxPrice?: number;
}

/**
 * Category filter nav (server-rendered links, DB-driven with counts).
 * Horizontal scroll on mobile, wraps on desktop. Active pill carries
 * aria-current. Search slots in beside this component in a later phase.
 */
export function CategoryFilter({
  categories,
  activeSlug,
  total,
  query,
}: {
  categories: ProductCategory[];
  activeSlug?: string;
  total: number;
  /** Preserved across category switches (search, sort, price). */
  query: FilterQuery;
}) {
  const hrefFor = (categorySlug?: string) =>
    buildCatalogueHref({ ...query, categorySlug });
  return (
    <nav aria-label="Filter by category">
      <ul className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap">
        <li className="shrink-0">
          <Link
            href={hrefFor()}
            aria-current={!activeSlug ? "page" : undefined}
            className={`inline-flex h-10 items-center rounded-md border px-4 text-sm font-semibold whitespace-nowrap ${
              !activeSlug
                ? "border-brand-800 bg-brand-800 text-white"
                : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50"
            }`}
          >
            All products
            <span
              aria-label={`${total} products`}
              className={`ml-2 rounded px-1.5 py-0.5 text-xs font-bold ${
                !activeSlug ? "bg-brand-700 text-white" : "bg-zinc-100 text-zinc-600"
              }`}
            >
              {total}
            </span>
          </Link>
        </li>
        {categories.map((c) => {
          const active = c.slug === activeSlug;
          return (
            <li key={c.slug} className="shrink-0">
              <Link
                href={hrefFor(c.slug)}
                aria-current={active ? "page" : undefined}
                className={`inline-flex h-10 items-center rounded-md border px-4 text-sm font-semibold whitespace-nowrap ${
                  active
                    ? "border-brand-800 bg-brand-800 text-white"
                    : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50"
                }`}
              >
                {c.name}
                <span
                  aria-label={`${c.productCount} products`}
                  className={`ml-2 rounded px-1.5 py-0.5 text-xs font-bold ${
                    active ? "bg-brand-700 text-white" : "bg-zinc-100 text-zinc-600"
                  }`}
                >
                  {c.productCount}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
