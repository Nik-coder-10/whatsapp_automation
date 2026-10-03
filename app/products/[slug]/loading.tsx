import { Container } from "@/components/ui/Container";
import { Skeleton } from "@/components/ui/Skeleton";

/** Product detail loading state: gallery + info column skeletons. */
export default function ProductDetailLoading() {
  return (
    <Container className="flex flex-col gap-6 py-6">
      <span role="status" className="sr-only">
        Loading product…
      </span>
      <div className="flex flex-col gap-4" aria-hidden>
        <Skeleton className="h-4 w-64" />
        <div className="grid gap-8 lg:grid-cols-2">
          <Skeleton className="aspect-[4/3] w-full" />
          <div className="flex flex-col gap-3">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>
    </Container>
  );
}
