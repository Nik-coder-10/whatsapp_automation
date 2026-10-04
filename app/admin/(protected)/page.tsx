import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/layout/admin/AdminShell";
import { Badge } from "@/components/ui/Badge";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { EmptyState } from "@/components/ui/States";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/ui/StatusBadge";
import {
  DASHBOARD_RANGES,
  getDashboardData,
  parseDashboardRange,
  type DashboardRange,
} from "@/lib/admin/dashboard";
import { signOutAdmin } from "@/lib/auth/actions";
import { priceToPaise } from "@/lib/catalog/products";
import type { OrderStatus, PaymentStatus } from "@/types";

export const metadata: Metadata = {
  title: "Admin Dashboard",
  robots: { index: false, follow: false },
};

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <p className="text-xs font-bold tracking-wide text-zinc-500 uppercase">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tracking-tight text-zinc-900">{value}</p>
    </div>
  );
}

function isOrderStatus(s: string): s is OrderStatus {
  return (
    ["draft","pending_payment","payment_submitted","paid","confirmed","processing","shipped","dispatched","delivered","cancelled"] as string[]
  ).includes(s);
}

function isPaymentStatus(s: string): s is PaymentStatus {
  return (
    ["pending","submitted","paid","failed","cancelled","refunded"] as string[]
  ).includes(s);
}

/** Admin operations overview — every number comes from the live database. */
export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const range: DashboardRange = parseDashboardRange(sp["range"]);
  let data = null;
  let loadError: string | null = null;
  try {
    data = await getDashboardData(range);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Dashboard unavailable.";
  }

  const counts = data?.status_counts ?? {};
  const totalOrders = Object.values(counts).reduce((n, c) => n + c, 0);
  const awaitingPayment = (counts["pending_payment"] ?? 0) + (counts["draft"] ?? 0);

  return (
    <AdminShell
      title="Dashboard"
      subtitle="Trolift operations overview"
      actions={
        <form action={signOutAdmin}>
          <button
            type="submit"
            className="inline-flex h-9 cursor-pointer items-center rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            Sign out
          </button>
        </form>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Time range">
        {DASHBOARD_RANGES.map((r) => {
          const active = r.value === range;
          return (
            <Link
              key={r.value}
              href={r.value === "all" ? "/admin" : `/admin?range=${r.value}`}
              aria-current={active ? "page" : undefined}
              className={`inline-flex h-9 items-center rounded-md border px-3 text-sm font-semibold ${
                active
                  ? "border-brand-800 bg-brand-800 text-white"
                  : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              {r.label}
            </Link>
          );
        })}
      </div>

      {loadError || !data ? (
        <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-5">
          <p className="font-bold text-red-800">Dashboard unavailable</p>
          <p className="mt-1 text-sm text-red-700">
            Could not load live data. Check the Supabase configuration and try again.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <section aria-label="Order statistics">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              <StatCard label="Total orders" value={String(totalOrders)} />
              <StatCard label="Awaiting payment" value={String(awaitingPayment)} />
              <StatCard label="Claims to verify" value={String(data.claims.length)} />
              <StatCard label="Confirmed" value={String(counts["confirmed"] ?? 0)} />
              <StatCard label="Processing" value={String(counts["processing"] ?? 0)} />
              <StatCard label="Dispatched" value={String(counts["dispatched"] ?? 0)} />
              <StatCard label="Delivered" value={String(counts["delivered"] ?? 0)} />
              <StatCard label="Cancelled" value={String(counts["cancelled"] ?? 0)} />
            </div>
            <div className="mt-3 rounded-lg border border-zinc-200 bg-white p-4">
              <p className="text-xs font-bold tracking-wide text-zinc-500 uppercase">
                Revenue from paid orders
              </p>
              <div className="mt-1">
                <PriceDisplay amountPaise={priceToPaise(data.paid_revenue)} size="md" />
              </div>
            </div>
          </section>

          <section aria-label="Payment claims awaiting verification" className="rounded-lg border border-amber-300 bg-white p-5">
            <h2 className="text-base font-bold text-zinc-900">
              Payment claims awaiting verification{" "}
              <span className="ml-1 rounded bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">
                {data.claims.length}
              </span>
            </h2>
            {data.claims.length === 0 ? (
              <EmptyState title="No pending claims" message="All submitted payments have been reviewed." />
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {data.claims.map((c) => (
                  <li
                    key={`${c.order_id}-${c.reference ?? "noref"}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-200 px-3 py-2.5 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-zinc-900">
                        <Link href={`/orders/${c.order_id}`} className="hover:text-brand-700 hover:underline">
                          {c.order_number}
                        </Link>{" "}
                        <span className="font-normal text-zinc-500">· {c.customer_name}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        UTR <span className="font-mono font-semibold">{c.reference ?? "—"}</span>
                        {" · "}
                        {new Date(c.submitted_at).toLocaleString("en-IN", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <PriceDisplay amountPaise={priceToPaise(c.amount)} size="sm" />
                      {isPaymentStatus(c.payment_status) ? (
                        <PaymentStatusBadge status={c.payment_status} />
                      ) : (
                        <Badge tone="neutral">{c.payment_status}</Badge>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-label="Recent orders" className="rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="text-base font-bold text-zinc-900">Recent orders</h2>
            {data.recent_orders.length === 0 ? (
              <EmptyState title="No orders yet" message="Orders appear here as customers check out." />
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-xs text-zinc-500 uppercase">
                      <th scope="col" className="py-2 pr-3 font-bold">Order</th>
                      <th scope="col" className="py-2 pr-3 font-bold">Customer</th>
                      <th scope="col" className="py-2 pr-3 font-bold">Amount</th>
                      <th scope="col" className="py-2 pr-3 font-bold">Payment</th>
                      <th scope="col" className="py-2 pr-3 font-bold">Status</th>
                      <th scope="col" className="py-2 font-bold">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent_orders.map((o) => (
                      <tr key={o.order_id} className="border-b border-zinc-100 last:border-0">
                        <td className="py-2.5 pr-3 font-bold text-zinc-900">
                          <Link href={`/orders/${o.order_id}`} className="hover:text-brand-700 hover:underline">
                            {o.order_number}
                          </Link>
                        </td>
                        <td className="py-2.5 pr-3 text-zinc-700">{o.customer_name}</td>
                        <td className="py-2.5 pr-3 font-semibold text-zinc-900">
                          ₹{Number(o.total_amount).toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="py-2.5 pr-3">
                          {isPaymentStatus(o.payment_status) ? (
                            <PaymentStatusBadge status={o.payment_status} />
                          ) : (
                            <Badge tone="neutral">{o.payment_status}</Badge>
                          )}
                        </td>
                        <td className="py-2.5 pr-3">
                          {isOrderStatus(o.order_status) ? (
                            <OrderStatusBadge status={o.order_status} />
                          ) : (
                            <Badge tone="neutral">{o.order_status}</Badge>
                          )}
                        </td>
                        <td className="py-2.5 text-xs whitespace-nowrap text-zinc-500">
                          {new Date(o.created_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </AdminShell>
  );
}
