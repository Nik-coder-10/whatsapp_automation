import { revalidatePath } from "next/cache";
import { badRequest, notFound, ok } from "@/lib/api/response";
import { AppError, handleRouteError } from "@/lib/api/errors";
import { getAdminProduct, updateAdminProduct } from "@/lib/admin/products";
import { coerceProductInput } from "@/app/api/admin/products/route";

/** GET /api/admin/products/[id] — one product with specs (admins only). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const product = await getAdminProduct(id);
    if (!product) return notFound("Product not found.");
    return ok(product);
  } catch (error) {
    return handleRouteError(error);
  }
}

/** PATCH /api/admin/products/[id] — full update (admins only). */
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
      return badRequest("Product details are required.");
    }
    await updateAdminProduct(id, coerceProductInput(body));
    // Listing + homepage refresh immediately. Prerendered detail pages
    // for existing slugs refresh on next build; unknown slugs 404 until
    // then (documented catalogue limitation).
    revalidatePath("/products");
    revalidatePath("/");
    return ok({ id });
  } catch (error) {
    return handleRouteError(error);
  }
}
