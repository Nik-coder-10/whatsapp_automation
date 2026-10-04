import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { AppError } from "@/lib/api/errors";
import {
  isValidEmail,
  isValidGstin,
  isValidIndianPhone,
  normalizeGstin,
  normalizePhone,
} from "@/lib/validations/common";

/**
 * Admin customer management (server-only, admins only).
 *
 * Reads go through the aggregate RPCs (single round-trip, no N+1, no
 * full-table pulls). Edits touch ONLY the current customer profile —
 * historical order snapshots are separate rows and are never rewritten.
 * Every entry point starts with requireAdmin().
 */

export type AdminCustomerSort =
  | "newest" | "oldest" | "orders_desc" | "paid_desc" | "name_asc";

export interface AdminCustomerQuery {
  q?: string;
  sort: AdminCustomerSort;
  page: number;
  pageSize: number;
}

export const ADMIN_CUSTOMER_PAGE_SIZE = 15;

export function parseAdminCustomerQuery(
  sp: Record<string, string | string[] | undefined>,
): AdminCustomerQuery {
  const first = (v: string | string[] | undefined) =>
    (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
  const q = first(sp["q"]).slice(0, 60);
  const sortRaw = first(sp["sort"]);
  const page = Number(first(sp["page"]));
  return {
    ...(q === "" ? {} : { q }),
    sort:
      sortRaw === "oldest" || sortRaw === "orders_desc" ||
      sortRaw === "paid_desc" || sortRaw === "name_asc"
        ? sortRaw
        : "newest",
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    pageSize: ADMIN_CUSTOMER_PAGE_SIZE,
  };
}

export interface AdminCustomerRow {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  gstin: string | null;
  createdAt: string;
  orderCount: number;
  paidCount: number;
  paidTotalPaise: number;
  latestOrderAt: string | null;
}

export interface AdminCustomerDetail {
  customer: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    gstin: string | null;
    createdAt: string;
  };
  summary: {
    orderCount: number;
    paidCount: number;
    cancelledCount: number;
    paidTotalPaise: number;
    firstOrderAt: string | null;
    latestOrderAt: string | null;
  };
  orders: Array<{
    orderId: string;
    orderNumber: string;
    totalPaise: number;
    paymentStatus: string;
    orderStatus: string;
    createdAt: string;
  }>;
}

type AdminClient = Awaited<ReturnType<typeof createClient>>;

async function rpc<T>(
  client: AdminClient,
  fn: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await client.rpc(fn, args);
  if (error) {
    throw new AppError("INTERNAL_ERROR", "Could not load customer data.", 500);
  }
  return data as unknown as T;
}

export async function listAdminCustomers(query: AdminCustomerQuery): Promise<{
  customers: AdminCustomerRow[];
  total: number;
  page: number;
  totalPages: number;
}> {
  await requireAdmin();
  const client = await createClient();
  const result = await rpc<{
    total: number;
    customers: Array<{
      id: string;
      name: string;
      phone: string;
      email: string | null;
      gstin: string | null;
      created_at: string;
      order_count: number;
      paid_count: number;
      paid_total: string;
      latest_order_at: string | null;
    }>;
  }>(client, "get_admin_customers", {
    p_search: query.q ?? null,
    p_sort: query.sort,
    p_limit: query.pageSize,
    p_offset: (query.page - 1) * query.pageSize,
  });
  const total = result.total ?? 0;
  return {
    customers: (result.customers ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      gstin: c.gstin,
      createdAt: c.created_at,
      orderCount: c.order_count,
      paidCount: c.paid_count,
      paidTotalPaise: Math.round(Number(c.paid_total) * 100),
      latestOrderAt: c.latest_order_at,
    })),
    total,
    page: query.page,
    totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
  };
}

export async function getAdminCustomer(
  customerId: string,
): Promise<AdminCustomerDetail | null> {
  await requireAdmin();
  const client = await createClient();
  type DetailRpc = {
    customer: AdminCustomerDetail["customer"] | null;
    summary: {
      order_count: number;
      paid_count: number;
      cancelled_count: number;
      paid_total: string;
      first_order_at: string | null;
      latest_order_at: string | null;
    } | null;
    orders: Array<{
      order_id: string;
      order_number: string;
      total_amount: string;
      payment_status: string;
      order_status: string;
      created_at: string;
    }>;
  };
  const result: DetailRpc = await rpc(client, "get_admin_customer", {
    p_customer_id: customerId,
  });
  if (!result.customer) return null;
  return {
    customer: result.customer,
    summary: {
      orderCount: result.summary?.order_count ?? 0,
      paidCount: result.summary?.paid_count ?? 0,
      cancelledCount: result.summary?.cancelled_count ?? 0,
      paidTotalPaise: Math.round(Number(result.summary?.paid_total ?? 0) * 100),
      firstOrderAt: result.summary?.first_order_at ?? null,
      latestOrderAt: result.summary?.latest_order_at ?? null,
    },
    orders: (result.orders ?? []).map((o) => ({
      orderId: o.order_id,
      orderNumber: o.order_number,
      totalPaise: Math.round(Number(o.total_amount) * 100),
      paymentStatus: o.payment_status,
      orderStatus: o.order_status,
      createdAt: o.created_at,
    })),
  };
}

export interface CustomerEditInput {
  name: string;
  phone: string;
  email: string;
  gstin: string;
}

/**
 * Edit the CURRENT profile only. Snapshots on historical orders are
 * separate rows and are never touched by this function.
 */
export async function updateAdminCustomer(
  customerId: string,
  input: CustomerEditInput,
): Promise<void> {
  await requireAdmin();
  const name = input.name.trim();
  const phone = normalizePhone(input.phone);
  const email = input.email.trim();
  const gstin = input.gstin.trim();
  if (name.length < 2 || name.length > 200) {
    throw new AppError("VALIDATION_ERROR", "Name must be 2–200 characters.", 422);
  }
  if (!isValidIndianPhone(input.phone)) {
    throw new AppError("VALIDATION_ERROR", "Phone must be a valid mobile number.", 422);
  }
  if (email !== "" && !isValidEmail(email)) {
    throw new AppError("VALIDATION_ERROR", "Email must be valid or blank.", 422);
  }
  if (!isValidGstin(gstin)) {
    throw new AppError("VALIDATION_ERROR", "GSTIN must be valid or blank.", 422);
  }
  const client = await createClient();
  const { data, error } = await client
    .from("customers")
    .update({
      name,
      phone,
      email: email === "" ? null : email,
      gstin: gstin === "" ? null : normalizeGstin(gstin),
    })
    .eq("id", customerId)
    .select("id");
  if (error) {
    if (typeof error === "object" && error !== null && "code" in error &&
      (error as { code?: string }).code === "23505") {
      throw new AppError(
        "VALIDATION_ERROR",
        "Another customer already uses that phone or email.",
        409,
      );
    }
    throw new AppError("INTERNAL_ERROR", "Could not update the customer.", 500);
  }
  if (((data ?? []) as unknown as Array<unknown>).length === 0) {
    throw new AppError("NOT_FOUND", "Customer not found.", 404);
  }
}
