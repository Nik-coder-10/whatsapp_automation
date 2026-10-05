import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { AppError } from "@/lib/api/errors";

/**
 * Admin bulk-operation audit (server-only).
 *
 * Single choke point for recording high-impact admin actions
 * (imports, exports): who acted, on what dataset, when, and the
 * result summary. Append-only — no UPDATE/DELETE policies exist by
 * design, mirroring order_events. Logging never throws: a failed
 * audit insert is console-logged, never allowed to break the
 * operation it describes.
 */

export type AuditResult = "success" | "partial" | "failed";

export interface AuditEntry {
  actorUserId: string | null;
  operation: string;
  dataset: string;
  totalRows: number;
  insertedRows: number;
  updatedRows: number;
  failedRows: number;
  result: AuditResult;
  summary?: Record<string, unknown>;
}

export async function logAdminAudit(entry: AuditEntry): Promise<void> {
  try {
    const client = await createClient();
    const { error } = await client.from("admin_audit_log").insert({
      actor_user_id: entry.actorUserId,
      operation: entry.operation.slice(0, 60),
      dataset: entry.dataset.slice(0, 40),
      total_rows: entry.totalRows,
      inserted_rows: entry.insertedRows,
      updated_rows: entry.updatedRows,
      failed_rows: entry.failedRows,
      result: entry.result,
      summary: entry.summary ?? {},
    });
    if (error) {
      console.error("[admin] Audit insert failed:", error.message);
    }
  } catch (e) {
    console.error(
      "[admin] Audit insert failed:",
      e instanceof Error ? e.message : e,
    );
  }
}

export interface AuditRow {
  id: string;
  actorUserId: string | null;
  operation: string;
  dataset: string;
  totalRows: number;
  insertedRows: number;
  updatedRows: number;
  failedRows: number;
  result: AuditResult;
  createdAt: string;
}

/** Recent entries, newest first. Enforces admin itself. */
export async function listRecentAudits(limit = 20): Promise<AuditRow[]> {
  await requireAdmin();
  const client = await createClient();
  const { data, error } = await client
    .from("admin_audit_log")
    .select(
      "id,actor_user_id,operation,dataset,total_rows,inserted_rows," +
        "updated_rows,failed_rows,result,created_at",
    )
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(100, limit)));
  if (error) {
    throw new AppError("INTERNAL_ERROR", "Could not load audit log.", 500);
  }
  return ((data ?? []) as unknown as Array<{
    id: string;
    actor_user_id: string | null;
    operation: string;
    dataset: string;
    total_rows: number;
    inserted_rows: number;
    updated_rows: number;
    failed_rows: number;
    result: AuditResult;
    created_at: string;
  }>).map((r) => ({
    id: r.id,
    actorUserId: r.actor_user_id,
    operation: r.operation,
    dataset: r.dataset,
    totalRows: r.total_rows,
    insertedRows: r.inserted_rows,
    updatedRows: r.updated_rows,
    failedRows: r.failed_rows,
    result: r.result,
    createdAt: r.created_at,
  }));
}
