import { ok, rateLimited } from "@/lib/api/response";
import { AppError, handleRouteError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/rate-limit/index";
import { parseOrderRequestBody } from "@/lib/orders/request";
import { quoteOrder } from "@/lib/orders/quote";
import { fetchOrderSummary, persistOrder } from "@/lib/orders/create";

/**
 * POST /api/orders — place an order from cart + checkout details.
 *
 * Server-authoritative flow:
 *   validate input → fetch live products → verify active → validate
 *   quantities → subtotal → validate GSTIN/pincode → delivery engine →
 *   partner + charge → total → customer upsert → order + items +
 *   pending payment (one atomic RPC) → safe summary.
 *
 * The body carries IDs, quantities, customer details, pincode and an
 * idempotency key — and nothing else. Prices, charges, totals, partner
 * and statuses are all derived server-side. Retried requests with the
 * same key replay to the original order.
 */
export async function POST(req: Request) {
  try {
    const rl = checkRateLimit(req, "orders");
    if (!rl.allowed) return rateLimited(rl.resetMs);
    let body: unknown;
    try {
      body = (await req.json()) as unknown;
    } catch {
      throw new AppError("BAD_REQUEST", "Request body must be JSON.", 400);
    }
    const parsed = parseOrderRequestBody(body);
    const quote = await quoteOrder({
      items: parsed.items,
      pincode: parsed.pincode,
    });
    const persisted = await persistOrder({
      idempotencyKey: parsed.idempotencyKey,
      customer: parsed.customer,
      quote,
    });
    const summary = await fetchOrderSummary(persisted.orderId);
    return ok({ ...summary, duplicate: persisted.duplicate });
  } catch (error) {
    return handleRouteError(error);
  }
}
