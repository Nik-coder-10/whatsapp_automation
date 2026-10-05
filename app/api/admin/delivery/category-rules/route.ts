import { revalidatePath } from "next/cache";
import { badRequest, ok } from "@/lib/api/response";
import { AppError, handleRouteError } from "@/lib/api/errors";
import {
  createCategoryRule,
  listCategoryRules,
} from "@/lib/admin/delivery";
import type { CategoryRuleFormInput } from "@/lib/admin/delivery-validation";

/** GET /api/admin/delivery/category-rules (admins only). */
export async function GET() {
  try {
    return ok(await listCategoryRules());
  } catch (error) {
    return handleRouteError(error);
  }
}

/** POST — one rule per category (UNIQUE). */
export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = (await req.json()) as unknown;
    } catch {
      throw new AppError("BAD_REQUEST", "Request body must be JSON.", 400);
    }
    if (typeof body !== "object" || body === null) {
      return badRequest("Rule details are required.");
    }
    const r = body as Record<string, unknown>;
    const result = await createCategoryRule({
      category: String(r["category"] ?? ""),
      surchargeRupees: String(r["surchargeRupees"] ?? ""),
      note: String(r["note"] ?? ""),
    } satisfies CategoryRuleFormInput);
    revalidatePath("/admin/delivery");
    return ok(result, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
