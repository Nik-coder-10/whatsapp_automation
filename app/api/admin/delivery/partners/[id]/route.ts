import { revalidatePath } from "next/cache";
import { badRequest, ok } from "@/lib/api/response";
import { AppError, handleRouteError } from "@/lib/api/errors";
import { updateDeliveryPartner } from "@/lib/admin/delivery";
import { coercePartnerInput } from "@/app/api/admin/delivery/partners/route";

/** PATCH /api/admin/delivery/partners/[id] — full update. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    let body: unknown;
    try {
      body = (await req.json()) as unknown;
    } catch {
      throw new AppError("BAD_REQUEST", "Request body must be JSON.", 400);
    }
    if (typeof body !== "object" || body === null) {
      return badRequest("Partner details are required.");
    }
    await updateDeliveryPartner(id, coercePartnerInput(body));
    revalidatePath("/admin/delivery");
    return ok({ id });
  } catch (error) {
    return handleRouteError(error);
  }
}
