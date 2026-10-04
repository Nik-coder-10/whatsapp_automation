import { ok } from "@/lib/api/response";
import { handleRouteError } from "@/lib/api/errors";
import { listAdminOrders, parseAdminOrderQuery } from "@/lib/admin/orders";

/** GET /api/admin/orders — paginated, filtered order list (admins only). */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const params: Record<string, string | string[] | undefined> = {};
    url.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    const result = await listAdminOrders(parseAdminOrderQuery(params));
    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
