import { Container } from "@/components/ui/Container";
import { ProductCardSkeleton } from "@/components/ui/Skeleton";

/** Catalogue loading state: heading shimmer + card skeletons. */
export default function ProductsLoading() {
  return (
    <Container className="flex flex-col gap-6 py-6">
      <div className="flex flex-col gap-2" aria-hidden>
        <div className="h-3 w-24 rounded bg-zinc-200" />
        <div className="h-8 w-56 rounded bg-zinc-200" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    </Container>
  );
}
