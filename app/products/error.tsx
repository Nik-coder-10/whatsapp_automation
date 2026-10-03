"use client";

import { useEffect } from "react";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";

/** Catalogue error state (e.g. database unreachable at render time). */
export default function ProductsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[products] Catalogue error:", error);
  }, [error]);

  return (
    <Container>
      <div role="alert" className="flex flex-col items-start gap-3 py-10">
        <h1 className="text-xl font-bold text-zinc-900">
          Couldn&apos;t load the catalogue.
        </h1>
        <p className="max-w-md text-sm text-zinc-500">
          Please try again. If the problem persists, contact sales for
          availability and quotes.
        </p>
        <Button onClick={reset} variant="secondary">
          Try again
        </Button>
      </div>
    </Container>
  );
}
