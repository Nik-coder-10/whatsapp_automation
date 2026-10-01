export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <span role="status" aria-live="polite" className="inline-flex items-center gap-2 text-sm text-zinc-500">
      <span
        aria-hidden
        className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900"
      />
      {label}
    </span>
  );
}

export function LoadingState({ message = "Loading…" }: { message?: string }) {
  return (
    <div className="flex min-h-32 items-center justify-center py-10">
      <Spinner label={message} />
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong.",
  message = "Please try again. If the problem persists, contact Trolift support.",
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 py-10 text-center">
      <p className="text-base font-semibold text-zinc-900">{title}</p>
      <p className="max-w-sm text-sm text-zinc-500">{message}</p>
      {onRetry ? (
        <button
          onClick={onRetry}
          className="mt-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({ title, message }: { title: string; message?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <p className="text-base font-semibold text-zinc-900">{title}</p>
      {message ? <p className="max-w-sm text-sm text-zinc-500">{message}</p> : null}
    </div>
  );
}
