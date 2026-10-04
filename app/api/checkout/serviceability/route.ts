import { badRequest, ok } from "@/lib/api/response";
import { AppError, handleRouteError } from "@/lib/api/errors";
import { checkServiceability } from "@/lib/delivery/serviceability";
import { normalizePincode } from "@/lib/validations/common";

/**
 * POST /api/checkout/serviceability — { pincode } → availability result.
 *
 * The ONLY delivery lookup the browser may use. Partner selection and
 * charges resolve here server-side from trusted rate rows; the client
 * only displays the verdict. No order is created by this endpoint.
 */
export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = (await req.json()) as unknown;
    } catch {
      throw new AppError("BAD_REQUEST", "Request body must be JSON.", 400);
    }
    const pincode =
      typeof body === "object" && body !== null
        ? normalizePincode(String((body as Record<string, unknown>)["pincode"] ?? ""))
        : "";
    if (pincode === "") {
      return badRequest("Delivery pincode is required.");
    }
    const result = await checkServiceability({ pincode });
    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
