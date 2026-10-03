import Link from "next/link";

/** Page navigation preserving the active category filter. */
export function Pagination({
  page,
  totalPages,
  categorySlug,
}: {
  page: number;
  totalPages: number;
  categorySlug?: string;
}) {
  if (totalPages <= 1) return null;
  const hrefFor = (p: number) =>
    categorySlug
      ? `/products?category=${categorySlug}&page=${p}`
      : `/products?page=${p}`;
  const prev = page > 1;
  const next = page < totalPages;

  const btn =
    "inline-flex h-11 items-center rounded-md border px-5 text-sm font-semibold";
  return (
    <nav aria-label="Product pages" className="flex items-center justify-center gap-3">
      {prev ? (
        <Link
          href={hrefFor(page - 1)}
          aria-label={`Go to page ${page - 1}`}
          className={`${btn} border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50`}
        >
          ← Previous
        </Link>
      ) : (
        <span aria-disabled="true" className={`${btn} cursor-not-allowed border-zinc-200 bg-zinc-50 text-zinc-400`}>
          ← Previous
        </span>
      )}
      <p role="status" aria-live="polite" className="text-sm font-medium text-zinc-600">
        Page {page} of {totalPages}
      </p>
      {next ? (
        <Link
          href={hrefFor(page + 1)}
          aria-label={`Go to page ${page + 1}`}
          className={`${btn} border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50`}
        >
          Next →
        </Link>
      ) : (
        <span aria-disabled="true" className={`${btn} cursor-not-allowed border-zinc-200 bg-zinc-50 text-zinc-400`}>
          Next →
        </span>
      )}
    </nav>
  );
}
