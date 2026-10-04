import { revalidatePath } from "next/cache";
import { badRequest, ok } from "@/lib/api/response";
import { AppError, handleRouteError } from "@/lib/api/errors";
import { importDeliveryRates } from "@/lib/admin/delivery";
import { parseRateCsv } from "@/lib/admin/delivery-import";

/**
 * POST /api/admin/delivery/rates/import — CSV bulk import.
 * Body: { csv: string }. Every row is validated before anything is
 * written; a file with any invalid row commits nothing. Response is
 * the full summary (total/valid/invalid/inserted/updated/skipped)
 * with per-row errors — nothing is silently discarded.
 */
export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = (await req.json()) as unknown;
    } catch {
      throw new AppError("BAD_REQUEST", "Request body must be JSON.", 400);
    }
    const csv =
      typeof body === "object" && body !== null
        ? String((body as Record<string, unknown>)["csv"] ?? "")
        : "";
    if (csv.trim() === "") {
      return badRequest("CSV content is required.");
    }
    if (csv.length > 500_000) {
      return badRequest("CSV is too large (500 KB limit).");
    }
    const parsed = parseRateCsv(csv);
    if (parsed.errors.length > 0) {
      return ok({
        total: parsed.rows.length + parsed.errors.length,
        valid: 0,
        invalid: parsed.errors,
        inserted: 0,
        updated: 0,
        skipped: parsed.rows.length,
      });
    }
    const summary = await importDeliveryRates(parsed.rows);
    revalidatePath("/admin/delivery");
    return ok(summary);
  } catch (error) {
    return handleRouteError(error);
  }
}
