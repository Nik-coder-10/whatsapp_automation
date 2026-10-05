import { revalidatePath } from "next/cache";
import { ok } from "@/lib/api/response";
import { handleRouteError } from "@/lib/api/errors";
import { deleteWeightSlab } from "@/lib/admin/delivery";

/** DELETE /api/admin/delivery/slabs/[id] — remove a band (orders keep snapshots). */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await deleteWeightSlab(id);
    revalidatePath("/admin/delivery");
    return ok({ id });
  } catch (error) {
    return handleRouteError(error);
  }
}
