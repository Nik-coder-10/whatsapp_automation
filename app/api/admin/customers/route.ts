import { ok } from "@/lib/api/response";
import { handleRouteError } from "@/lib/api/errors";
import {
  listAdminCustomers,
  parseAdminCustomerQuery,
} from "@/lib/admin/customers";

/** GET /api/admin/customers — searchable, paginated list (admins only). */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const params: Record<string, string | string[] | undefined> = {};
    url.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    return ok(await listAdminCustomers(parseAdminCustomerQuery(params)));
  } catch (error) {
    return handleRouteError(error);
  }
}
