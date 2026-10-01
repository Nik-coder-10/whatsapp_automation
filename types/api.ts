/**
 * Standard API envelope used by every Next.js Route Handler.
 *
 * Success:  { ok: true,  data: T }
 * Failure:  { ok: false, error: { code, message, details? } }
 */

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiFailure {
  ok: false;
  error: {
    /** Stable machine-readable code, e.g. "VALIDATION_ERROR". */
    code: string;
    /** Human-readable message safe to show in the UI. */
    message: string;
    /** Optional field-level details (never secrets). */
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
