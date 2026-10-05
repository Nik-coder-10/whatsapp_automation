import { revalidatePath } from "next/cache";
import { badRequest, ok } from "@/lib/api/response";
import { AppError, handleRouteError } from "@/lib/api/errors";
import {
  createWeightSlab,
  listWeightSlabs,
} from "@/lib/admin/delivery";
import type { SlabFormInput } from "@/lib/admin/delivery-validation";

/** GET /api/admin/delivery/slabs — all weight bands (admins only). */
export async function GET() {
  try {
    return ok(await listWeightSlabs());
  } catch (error) {
    return handleRouteError(error);
  }
}

/** POST — create one band (overlap-checked per partner). */
export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = (await req.json()) as unknown;
    } catch {
      throw new AppError("BAD_REQUEST", "Request body must be JSON.", 400);
    }
    if (typeof body !== "object" || body === null) {
      return badRequest("Slab details are required.");
    }
    const r = body as Record<string, unknown>;
    const result = await createWeightSlab({
      partnerId: String(r["partnerId"] ?? ""),
      minKg: String(r["minKg"] ?? ""),
      maxKg: String(r["maxKg"] ?? ""),
      chargeRupees: String(r["chargeRupees"] ?? ""),
    } satisfies SlabFormInput);
    revalidatePath("/admin/delivery");
    return ok(result, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
