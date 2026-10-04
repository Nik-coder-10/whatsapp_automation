import { badRequest, notFound, ok } from "@/lib/api/response";
import { AppError, handleRouteError } from "@/lib/api/errors";
import { getAdminCustomer, updateAdminCustomer } from "@/lib/admin/customers";

/** GET /api/admin/customers/[id] — profile + summary + history. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const detail = await getAdminCustomer(id);
    if (!detail) return notFound("Customer not found.");
    return ok(detail);
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * PATCH /api/admin/customers/[id] — edit the CURRENT profile only.
 * Historical order snapshots are separate rows and never change.
 */
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
      return badRequest("Customer details are required.");
    }
    const r = body as Record<string, unknown>;
    await updateAdminCustomer(id, {
      name: String(r["name"] ?? ""),
      phone: String(r["phone"] ?? ""),
      email: String(r["email"] ?? ""),
      gstin: String(r["gstin"] ?? ""),
    });
    return ok({ id });
  } catch (error) {
    return handleRouteError(error);
  }
}
