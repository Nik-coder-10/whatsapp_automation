import { badRequest, ok } from "@/lib/api/response";
import { AppError, handleRouteError } from "@/lib/api/errors";
import { submitPaymentClaim } from "@/lib/payments/submit";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/payments/claim — { orderId, reference } → SUBMITTED.
 *
 * Records the customer's payment claim (UTR) for admin verification.
 * Accepts NO amount — the authoritative total stays server-side.
 * Never marks anything paid; only pending/failed payments in
 * payable order states may transition.
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
    const reference = String(record["reference"] ?? "");
    const phone = String(record["phone"] ?? "");
    if (!UUID_RE.test(orderId)) {
      return badRequest("A valid order is required.");
    }
    if (reference.trim() === "") {
      return badRequest("Payment reference is required.");
    }
    if (phone.trim() === "") {
      return badRequest("The mobile number from the order is required.");
    }
    const result = await submitPaymentClaim({ orderId, reference, phone });
    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
