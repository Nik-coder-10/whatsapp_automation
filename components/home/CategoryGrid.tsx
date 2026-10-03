import Link from "next/link";
import { EmptyState } from "@/components/ui/States";
import { getCategories } from "@/lib/catalog/queries";

/** Category browse grid fed by live catalogue data (DB-first, fallback static). */
export async function CategoryGrid() {
  const categories = await getCategories();

  return (
    <section aria-labelledby="categories-heading" id="categories" className="scroll-mt-20">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-bold tracking-[0.14em] text-brand-700 uppercase">Catalogue</p>
          <h2 id="categories-heading" className="mt-1 text-2xl font-extrabold tracking-tight text-zinc-900">
            Shop by equipment type
          </h2>
        </div>
      </div>
      {categories.length === 0 ? (
        <EmptyState
          title="Categories coming soon"
          message="Our equipment range is being loaded into the catalogue. Check the featured products below or contact sales."
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <li key={c.slug} className="rounded-lg border border-zinc-200 bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-base font-bold text-zinc-900">{c.name}</h3>
                <span className="shrink-0 rounded bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-800">
                  {c.productCount} {c.productCount === 1 ? "item" : "items"}
                </span>
              </div>
              <p className="mt-1.5 text-sm leading-6 text-zinc-600">{c.blurb}</p>
              <Link
                href={`/products?category=${c.slug}`}
                className="mt-3 inline-block text-sm font-semibold text-brand-700 hover:underline"
              >
                Browse {c.name} →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
