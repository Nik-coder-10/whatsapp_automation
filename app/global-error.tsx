"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div
          role="alert"
          style={{ padding: 32, fontFamily: "system-ui, sans-serif" }}
        >
          <h1>Something went wrong.</h1>
          <p>Please reload the page. If the problem persists, contact support.</p>
          <button onClick={reset} style={{ marginTop: 12 }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
