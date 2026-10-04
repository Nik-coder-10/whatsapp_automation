/**
 * Rate limiting foundation (server-only usage in Route Handlers).
 *
 * Sliding-window counter keyed by route + client IP. The default
 * store is in-process memory — correct for a single instance and for
 * abuse-throttling; swap `defaultStore` for a Redis/Upstash backend
 * implementing RateLimitStore when horizontally scaling, without
 * touching any route.
 */

export interface RateLimitOptions {
  /** Max requests per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Milliseconds until the oldest hit in the window expires. */
  resetMs: number;
}

export interface RateLimitStore {
  check(key: string, opts: RateLimitOptions): RateLimitResult;
  reset(): void;
}

function prune(hits: number[], now: number, windowMs: number): number[] {
  return hits.filter((t) => t > now - windowMs);
}

export class MemoryRateLimitStore implements RateLimitStore {
  private readonly hits = new Map<string, number[]>();

  check(key: string, opts: RateLimitOptions): RateLimitResult {
    const now = Date.now();
    const recent = prune(this.hits.get(key) ?? [], now, opts.windowMs);
    if (recent.length >= opts.limit) {
      const oldest = recent[0] ?? now;
      this.hits.set(key, recent);
      return { allowed: false, remaining: 0, resetMs: oldest + opts.windowMs - now };
    }
    recent.push(now);
    this.hits.set(key, recent);
    return {
      allowed: true,
      remaining: opts.limit - recent.length,
      resetMs: opts.windowMs,
    };
  }

  reset(): void {
    this.hits.clear();
  }
}

export const defaultStore = new MemoryRateLimitStore();

/** Test/ops hook: clears all in-memory counters. */
export function resetRateLimits(): void {
  defaultStore.reset();
}

function readEnvInt(name: string, fallback: number): number {
  const raw = Number(process.env[name] ?? "");
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

/** Per-route budgets (requests/minute, env-overridable). */
export function routeLimit(route: "orders" | "claim" | "delivery"): RateLimitOptions {
  const windowMs = readEnvInt("RATE_LIMIT_WINDOW_MS", 60_000);
  switch (route) {
    case "orders":
      return { limit: readEnvInt("RATE_LIMIT_ORDERS_PER_MIN", 10), windowMs };
    case "claim":
      return { limit: readEnvInt("RATE_LIMIT_CLAIM_PER_MIN", 10), windowMs };
    case "delivery":
      return { limit: readEnvInt("RATE_LIMIT_DELIVERY_PER_MIN", 60), windowMs };
  }
}

function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return first;
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Check the caller's budget for a route. Internal server-to-server
 * calls never pass through here (lib functions, not HTTP), so they
 * are unaffected by design.
 */
export function checkRateLimit(
  req: Request,
  route: "orders" | "claim" | "delivery",
  store: RateLimitStore = defaultStore,
): RateLimitResult {
  return store.check(`rl:${route}:${clientIp(req)}`, routeLimit(route));
}
