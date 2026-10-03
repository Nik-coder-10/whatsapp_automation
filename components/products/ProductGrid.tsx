import { ProductCard } from "@/components/products/ProductCard";
import type { CatalogProduct } from "@/lib/catalog/products";

/** Responsive product grid (1 → 2 → 3 → 4 columns). */
export function ProductGrid({ products }: { products: CatalogProduct[] }) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((p) => (
        <li key={p.id} className="min-w-0">
          <ProductCard product={p} />
        </li>
      ))}
    </ul>
  );
}
