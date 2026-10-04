import { badRequest, ok } from "@/lib/api/response";
import { AppError, handleRouteError } from "@/lib/api/errors";
import { transitionOrderStatus } from "@/lib/admin/orders";
import type { OrderStatus } from "@/types";

const STATUSES: ReadonlyArray<OrderStatus> = [
  "draft", "pending_payment", "payment_submitted", "paid", "confirmed",
  "processing", "shipped", "dispatched", "delivered", "cancelled",
];

/**
 * POST /api/admin/orders/status — move an order through valid
 * transitions only. Body: { orderId, toStatus }. No totals, no
 * prices, no payment flags accepted.
 */
export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = (await req.json()) as unknown;
    } catch {
      throw new AppError("BAD_REQUEST", "Request body must be JSON.", 400);
    }
    const record =
      typeof body === "object" && body !== null
        ? (body as Record<string, unknown>)
        : {};
    const orderId = String(record["orderId"] ?? "");
    const toStatus = String(record["toStatus"] ?? "") as OrderStatus;
    if (orderId === "") {
      return badRequest("An order is required.");
    }
    if (!STATUSES.includes(toStatus)) {
      return badRequest("Unknown target status.");
    }
    const result = await transitionOrderStatus(orderId, toStatus);
    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
