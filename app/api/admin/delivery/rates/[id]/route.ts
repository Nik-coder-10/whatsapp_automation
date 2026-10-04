import { revalidatePath } from "next/cache";
import { ok } from "@/lib/api/response";
import { handleRouteError } from "@/lib/api/errors";
import { deleteDeliveryRate } from "@/lib/admin/delivery";

/** DELETE /api/admin/delivery/rates/[id] — remove a rule (orders keep snapshots). */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await deleteDeliveryRate(id);
    revalidatePath("/admin/delivery");
    return ok({ id });
  } catch (error) {
    return handleRouteError(error);
  }
}
