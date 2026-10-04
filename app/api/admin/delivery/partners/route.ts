import { revalidatePath } from "next/cache";
import { badRequest, ok } from "@/lib/api/response";
import { AppError, handleRouteError } from "@/lib/api/errors";
import {
  createDeliveryPartner,
  listDeliveryPartners,
} from "@/lib/admin/delivery";
import type { PartnerFormInput } from "@/lib/admin/delivery-validation";

/** GET /api/admin/delivery/partners — all partners with rate counts. */
export async function GET() {
  try {
    return ok(await listDeliveryPartners());
  } catch (error) {
    return handleRouteError(error);
  }
}

/** POST /api/admin/delivery/partners — create (whitelisted fields only). */
export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = (await req.json()) as unknown;
    } catch {
      throw new AppError("BAD_REQUEST", "Request body must be JSON.", 400);
    }
    if (typeof body !== "object" || body === null) {
      return badRequest("Partner details are required.");
    }
    const id = await createDeliveryPartner(coercePartnerInput(body));
    revalidatePath("/admin/delivery");
    return ok({ id }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

export function coercePartnerInput(body: unknown): PartnerFormInput {
  const r = body as Record<string, unknown>;
  const priority = r["priority"];
  return {
    name: String(r["name"] ?? ""),
    contactName: String(r["contactName"] ?? ""),
    contactPhone: String(r["contactPhone"] ?? ""),
    contactEmail: String(r["contactEmail"] ?? ""),
    priority: typeof priority === "number" ? priority : Number(priority ?? NaN),
    isActive: r["isActive"] !== false,
  };
}
