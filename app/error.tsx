"use client";

import { useEffect } from "react";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] Route error:", error);
  }, [error]);

  return (
    <Container>
      <div role="alert" className="flex flex-col items-start gap-3 py-10">
        <h1 className="text-xl font-bold text-zinc-900">Something went wrong.</h1>
        <p className="max-w-md text-sm text-zinc-500">
          Please try again. If the problem persists, contact Trolift support.
        </p>
        <Button onClick={reset} variant="secondary">
          Try again
        </Button>
      </div>
    </Container>
  );
}
