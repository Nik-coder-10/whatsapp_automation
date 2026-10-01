import { fail, internalError } from "@/lib/api/response";

/**
 * Shared Route Handler error boundary.
 *
 * - Known AppError → mapped to its status/code (message is UI-safe).
 * - Unknown errors → logged server-side, generic 500 to the client
 *   (never leak stack traces or secrets).
 */
export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: string, message: string, status = 400, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function handleRouteError(error: unknown) {
  if (error instanceof AppError) {
    return fail(error.code, error.message, {
      status: error.status,
      details: error.details,
    });
  }
  console.error("[api] Unhandled route error:", error);
  return internalError();
}
