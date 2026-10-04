import { notFound, ok } from "@/lib/api/response";
import { handleRouteError } from "@/lib/api/errors";
import { getAdminOrderDetail } from "@/lib/admin/orders";

/** GET /api/admin/orders/[id] — full order detail (admins only). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const detail = await getAdminOrderDetail(id);
    if (!detail) return notFound("Order not found.");
    return ok(detail);
  } catch (error) {
    return handleRouteError(error);
  }
}
