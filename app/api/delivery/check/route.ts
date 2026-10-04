import { badRequest, ok, rateLimited } from "@/lib/api/response";
import { AppError, handleRouteError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/rate-limit/index";
import { quoteDelivery } from "@/lib/delivery/engine";
import { normalizePincode } from "@/lib/validations/common";

/**
 * POST /api/delivery/check — { pincode, subtotalPaise? } → delivery quote.
 *
 * Server authority: validates the pincode, queries trusted rate rows,
 * applies the selection strategy and returns the verdict. The browser
 * only displays it; the order API repeats the calculation and never
 * trusts client money. Creates nothing.
 */
export async function POST(req: Request) {
  try {
    const rl = checkRateLimit(req, "delivery");
    if (!rl.allowed) return rateLimited(rl.resetMs);
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
    const pincode = normalizePincode(String(record["pincode"] ?? ""));
    if (pincode === "") {
      return badRequest("Delivery pincode is required.");
    }
    const rawSubtotal = record["subtotalPaise"];
    const subtotalPaise =
      rawSubtotal === undefined || rawSubtotal === null
        ? undefined
        : Number(rawSubtotal);
    if (
      subtotalPaise !== undefined &&
      (!Number.isInteger(subtotalPaise) || subtotalPaise < 0)
    ) {
      return badRequest("Order subtotal must be a non-negative integer.");
    }
    const quote = await quoteDelivery(pincode, subtotalPaise);
    return ok({
      serviceable: quote.serviceable,
      pincode: quote.pincode,
      partner: quote.selected?.partner ?? null,
      deliveryChargePaise: quote.selected?.deliveryChargePaise ?? null,
      ...(quote.selected?.etaDays ? { etaDays: quote.selected.etaDays } : {}),
      options: quote.options,
      ...(quote.reason ? { reason: quote.reason } : {}),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
