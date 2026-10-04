import { revalidatePath } from "next/cache";
import { badRequest, ok } from "@/lib/api/response";
import { AppError, handleRouteError } from "@/lib/api/errors";
import { setProductActive } from "@/lib/admin/products";

/**
 * POST /api/admin/products/[id]/active — deactivate/reactivate.
 * Body: { isActive: boolean }. Products are never hard-deleted, so
 * historical orders keep their snapshots and FK integrity.
 */
export async function POST(
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
    const isActive =
      typeof body === "object" && body !== null
        ? (body as Record<string, unknown>)["isActive"]
        : undefined;
    if (typeof isActive !== "boolean") {
      return badRequest("isActive must be true or false.");
    }
    await setProductActive(id, isActive);
    revalidatePath("/products");
    revalidatePath("/");
    return ok({ id, isActive });
  } catch (error) {
    return handleRouteError(error);
  }
}
