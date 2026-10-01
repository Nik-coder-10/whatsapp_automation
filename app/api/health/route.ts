import { ok } from "@/lib/api/response";

/**
 * GET /api/health — liveness probe + convention example.
 * No auth, no secrets, no DB access. Safe for load balancers.
 */
export async function GET() {
  return ok({
    status: "ok",
    service: "trolift-platform",
    time: new Date().toISOString(),
  });
}
