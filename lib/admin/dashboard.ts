import { createClient } from "@/lib/supabase/server";

/**
 * Admin dashboard data (server-only, admins only).
 *
 * Single RPC round-trip (get_admin_dashboard) instead of N queries:
 * status counts, paid-only revenue, submitted claims and recent
 * orders. The RPC itself re-checks is_admin(), so a non-admin caller
 * gets an error, never data. Amounts arrive as NUMERIC decimal
 * strings; the UI converts to integer paise.
 */

export type DashboardRange = "today" | "7d" | "30d" | "all";

export const DASHBOARD_RANGES: ReadonlyArray<{
  value: DashboardRange;
  label: string;
  days: number | null;
}> = [
  { value: "today", label: "Today", days: 1 },
  { value: "7d", label: "7 days", days: 7 },
  { value: "30d", label: "30 days", days: 30 },
  { value: "all", label: "All time", days: null },
];

export function parseDashboardRange(
  value: string | string[] | undefined,
): DashboardRange {
  const v = Array.isArray(value) ? value[0] : value;
  return v === "today" || v === "7d" || v === "30d" || v === "all" ? v : "all";
}

export function rangeDays(range: DashboardRange): number | null {
  return DASHBOARD_RANGES.find((r) => r.value === range)?.days ?? null;
}

export interface DashboardClaim {
  order_id: string;
  order_number: string;
  amount: string;
  customer_name: string;
  reference: string | null;
  payment_status: string;
  submitted_at: string;
}

export interface DashboardOrder {
  order_id: string;
  order_number: string;
  customer_name: string;
  total_amount: string;
  payment_status: string;
  order_status: string;
  created_at: string;
}

export interface DashboardData {
  status_counts: Record<string, number>;
  paid_revenue: string;
  claims: DashboardClaim[];
  recent_orders: DashboardOrder[];
}

export async function getDashboardData(
  range: DashboardRange,
): Promise<DashboardData> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_admin_dashboard", {
    p_days: rangeDays(range),
  });
  if (error) {
    throw new Error(`[admin] Dashboard query failed: ${error.message}`);
  }
  const d = data as unknown as DashboardData | null;
  if (!d || typeof d !== "object") {
    throw new Error("[admin] Dashboard returned no data.");
  }
  return {
    status_counts: d.status_counts ?? {},
    paid_revenue: d.paid_revenue ?? "0",
    claims: Array.isArray(d.claims) ? d.claims : [],
    recent_orders: Array.isArray(d.recent_orders) ? d.recent_orders : [],
  };
}
