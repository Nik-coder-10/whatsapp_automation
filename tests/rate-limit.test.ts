import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MemoryRateLimitStore,
  checkRateLimit,
  resetRateLimits,
  routeLimit,
} from "@/lib/rate-limit/index";
import { rateLimited } from "@/lib/api/response";

const req = (ip?: string) =>
  new Request("http://localhost/x", {
    method: "POST",
    headers: ip ? { "x-forwarded-for": ip } : {},
  });

describe("MemoryRateLimitStore", () => {
  it("allows requests under the limit with remaining counts", () => {
    const store = new MemoryRateLimitStore();
    expect(store.check("k", { limit: 3, windowMs: 60_000 })).toMatchObject({
      allowed: true,
      remaining: 2,
    });
    expect(store.check("k", { limit: 3, windowMs: 60_000 })).toMatchObject({
      allowed: true,
      remaining: 1,
    });
    expect(store.check("k", { limit: 3, windowMs: 60_000 })).toMatchObject({
      allowed: true,
      remaining: 0,
    });
  });

  it("blocks over the limit without recording the hit", () => {
    const store = new MemoryRateLimitStore();
    const opts = { limit: 1, windowMs: 60_000 };
    expect(store.check("k", opts).allowed).toBe(true);
    const denied = store.check("k", opts);
    expect(denied.allowed).toBe(false);
    expect(denied.remaining).toBe(0);
    expect(denied.resetMs).toBeGreaterThan(0);
    expect(denied.resetMs).toBeLessThanOrEqual(60_000);
  });

  it("isolates keys from each other", () => {
    const store = new MemoryRateLimitStore();
    const opts = { limit: 1, windowMs: 60_000 };
    expect(store.check("a", opts).allowed).toBe(true);
    expect(store.check("a", opts).allowed).toBe(false);
    expect(store.check("b", opts).allowed).toBe(true);
  });

  it("resets after the window passes", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(0);
      const store = new MemoryRateLimitStore();
      const opts = { limit: 1, windowMs: 60_000 };
      expect(store.check("k", opts).allowed).toBe(true);
      expect(store.check("k", opts).allowed).toBe(false);
      vi.setSystemTime(60_001);
      expect(store.check("k", opts).allowed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("reset() clears all counters", () => {
    const store = new MemoryRateLimitStore();
    const opts = { limit: 1, windowMs: 60_000 };
    expect(store.check("k", opts).allowed).toBe(true);
    store.reset();
    expect(store.check("k", opts).allowed).toBe(true);
  });
});

describe("checkRateLimit (route helper)", () => {
  beforeEach(() => resetRateLimits());
  afterEach(() => resetRateLimits());

  it("keys by route and client IP", () => {
    // Exhaust the orders budget for one IP via many rapid checks.
    let denied = false;
    for (let i = 0; i < 40; i++) {
      if (!checkRateLimit(req("1.2.3.4"), "orders").allowed) {
        denied = true;
        break;
      }
    }
    expect(denied).toBe(true);
    // A different IP is unaffected.
    expect(checkRateLimit(req("5.6.7.8"), "orders").allowed).toBe(true);
  });

  it("reads budgets from options with env-overridable route defaults", () => {
    expect(routeLimit("orders").limit).toBeGreaterThan(0);
    expect(routeLimit("delivery").limit).toBeGreaterThanOrEqual(
      routeLimit("orders").limit,
    );
  });
});

describe("rateLimited (429 response)", () => {
  it("returns a generic 429 with Retry-After and no quota details", async () => {
    const res = rateLimited(1500);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("2");
    const json = (await res.json()) as {
      ok: boolean;
      error: { code: string; message: string };
    };
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("RATE_LIMITED");
    expect(JSON.stringify(json)).not.toContain("1500");
  });
});
