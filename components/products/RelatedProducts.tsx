import { ProductCard } from "@/components/products/ProductCard";
import { getRelatedProducts } from "@/lib/catalog/queries";

/**
 * Related products rail (same category, active only). Renders nothing
 * when there is nothing relevant — no filler cards.
 */
export async function RelatedProducts({
  category,
  excludeId,
}: {
  category: string;
  excludeId: string;
}) {
  const related = await getRelatedProducts(category, excludeId);
  if (related.length === 0) return null;

  return (
    <section aria-labelledby="related-heading" className="mt-12">
      <h2 id="related-heading" className="text-xl font-extrabold tracking-tight text-zinc-900">
        Related equipment
      </h2>
      <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {related.map((p) => (
          <li key={p.id} className="min-w-0">
            <ProductCard product={p} />
          </li>
        ))}
      </ul>
    </section>
  );
}
