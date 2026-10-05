import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/layout/admin/AdminShell";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { EmptyState } from "@/components/ui/States";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/ui/StatusBadge";
import { PaymentActions } from "@/components/admin/PaymentActions";
import { StatusActions } from "@/components/admin/StatusActions";
import { getAdminOrderDetail } from "@/lib/admin/orders";

export const metadata: Metadata = {
  title: "Order detail",
  robots: { index: false, follow: false },
};

/** Admin order detail: snapshots, payment verification, transitions, audit. */
export default async function AdminOrderPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  let order = null;
  try {
    order = await getAdminOrderDetail(orderId);
  } catch {
    order = null;
  }

  return (
    <AdminShell title="Order detail" subtitle="Snapshots, payment and audit trail">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/admin" },
          { label: "Orders", href: "/admin/orders" },
          { label: order ? order.orderNumber : "Detail" },
        ]}
      />
      {!order ? (
        <div className="mt-4">
          <EmptyState
            title="Order not found"
            message="It may have been removed, or the link is wrong."
          />
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900">
              {order.orderNumber}
            </h1>
            <OrderStatusBadge status={order.orderStatus} />
            <PaymentStatusBadge status={order.paymentStatus} />
            {order.paymentStatus === "paid" ? (
              <span className="flex flex-wrap gap-2">
                <a
                  href={`/api/admin/orders/${order.id}/invoice`}
                  download
                  className="inline-flex h-10 items-center rounded-md bg-brand-800 px-4 text-sm font-bold text-white hover:bg-brand-700"
                >
                  Download Invoice
                </a>
                <a
                  href={`/api/admin/orders/${order.id}/invoice?disposition=inline`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 items-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-bold text-zinc-800 hover:bg-zinc-50"
                >
                  Print Invoice
                </a>
              </span>
            ) : null}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section aria-label="Customer" className="rounded-lg border border-zinc-200 bg-white p-5">
              <h2 className="text-base font-bold text-zinc-900">Customer</h2>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-zinc-500">Name</dt>
                  <dd className="font-semibold text-zinc-900">{order.customer.name}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Phone</dt>
                  <dd className="font-semibold text-zinc-900">{order.customer.phone}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Email</dt>
                  <dd className="font-semibold text-zinc-900">{order.customer.email ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">GSTIN (customer-provided)</dt>
                  <dd className="font-semibold text-zinc-900">{order.customer.gstin ?? "—"}</dd>
                </div>
              </dl>
            </section>

            {order.taxTreatment === "gst" ? (
              <section aria-label="GST billing" className="rounded-lg border border-zinc-200 bg-white p-5">
                <h2 className="text-base font-bold text-zinc-900">GST billing (order snapshot)</h2>
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-zinc-500">Billed to</dt>
                    <dd className="font-semibold text-zinc-900">{order.billing.name ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">Address</dt>
                    <dd className="font-semibold text-zinc-900">
                      {[order.billing.addressLine, order.billing.city, order.billing.state, order.billing.pincode]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">State code</dt>
                    <dd className="font-semibold text-zinc-900">{order.billing.stateCode ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">Tax type</dt>
                    <dd className="font-semibold text-zinc-900">
                      {order.cgstPaise > 0 || order.sgstPaise > 0 ? "CGST + SGST" : "IGST"}
                    </dd>
                  </div>
                </dl>
                <p className="mt-2 text-xs text-zinc-500">
                  Frozen at order time — editing the customer profile never changes this.
                </p>
              </section>
            ) : null}

            <section aria-label="Payment verification" className="rounded-lg border border-zinc-200 bg-white p-5">
              <h2 className="text-base font-bold text-zinc-900">Payment</h2>
              <dl className="mt-3 flex flex-col gap-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Status</dt>
                  <dd>
                    <PaymentStatusBadge status={order.paymentStatus} />
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-zinc-500">UTR / reference</dt>
                  <dd className="font-mono font-semibold text-zinc-900">
                    {order.paymentReference ?? "—"}
                  </dd>
                </div>
                {order.paymentUpdatedAt ? (
                  <div className="flex justify-between gap-2">
                    <dt className="text-zinc-500">Last update</dt>
                    <dd className="text-zinc-700">
                      {new Date(order.paymentUpdatedAt).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </dd>
                  </div>
                ) : null}
              </dl>
              {order.paymentStatus === "submitted" ? (
                <div className="mt-4">
                  <PaymentActions orderId={order.id} />
                </div>
              ) : (
                <p className="mt-3 text-xs leading-5 text-zinc-500">
                  Verification actions appear while a claim is submitted. Paid,
                  failed and refunded states change only through their own
                  transitions.
                </p>
              )}
            </section>
          </div>

          <section aria-label="Items" className="rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="text-base font-bold text-zinc-900">Items (purchase-time snapshots)</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {order.items.map((item) => (
                <li key={`${item.name}-${item.quantity}`} className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate text-zinc-700">
                    {item.name} × {item.quantity}{" "}
                    <span className="text-zinc-400">
                      @ ₹{(item.unitPricePaise / 100).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                      {item.gstRate !== null ? ` + ${Number(item.gstRate).toLocaleString("en-IN")}% GST` : null}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold text-zinc-900">
                    <PriceDisplay amountPaise={item.lineTotalPaise} size="sm" />
                  </span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 flex flex-col gap-1.5 border-t border-zinc-100 pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-zinc-600">Subtotal (ex-GST)</dt>
                <dd className="font-semibold text-zinc-900">
                  <PriceDisplay amountPaise={order.subtotalPaise} size="sm" />
                </dd>
              </div>
              {order.taxTreatment === "gst" ? (
                <>
                  {order.cgstPaise > 0 || order.sgstPaise > 0 ? (
                    <>
                      <div className="flex justify-between">
                        <dt className="text-zinc-600">CGST</dt>
                        <dd className="font-semibold text-zinc-900">
                          <PriceDisplay amountPaise={order.cgstPaise} size="sm" />
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-zinc-600">SGST</dt>
                        <dd className="font-semibold text-zinc-900">
                          <PriceDisplay amountPaise={order.sgstPaise} size="sm" />
                        </dd>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between">
                      <dt className="text-zinc-600">IGST</dt>
                      <dd className="font-semibold text-zinc-900">
                        <PriceDisplay amountPaise={order.igstPaise} size="sm" />
                      </dd>
                    </div>
                  )}
                </>
              ) : null}
              <div className="flex justify-between">
                <dt className="text-zinc-600">Delivery ({order.deliveryPartnerName})</dt>
                <dd className="font-semibold text-zinc-900">
                  <PriceDisplay amountPaise={order.deliveryChargePaise} size="sm" />
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-600">Pincode</dt>
                <dd className="font-semibold text-zinc-900">{order.deliveryPincode}</dd>
              </div>
              <div className="flex justify-between border-t border-zinc-100 pt-2 text-base">
                <dt className="font-bold text-zinc-900">Total</dt>
                <dd className="font-bold text-zinc-900">
                  <PriceDisplay amountPaise={order.totalPaise} size="md" />
                </dd>
              </div>
            </dl>
          </section>

          <section aria-label="Status management" className="rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="text-base font-bold text-zinc-900">Order status</h2>
            <div className="mt-2">
              <OrderStatusBadge status={order.orderStatus} />
            </div>
            <div className="mt-3">
              <StatusActions orderId={order.id} current={order.orderStatus} />
            </div>
          </section>

          <section aria-label="Audit trail" className="rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="text-base font-bold text-zinc-900">Activity</h2>
            {order.events.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">
                No admin actions recorded yet. Status changes and payment
                decisions will appear here with timestamps.
              </p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {order.events.map((e) => (
                  <li
                    key={`${e.createdAt}-${e.action}`}
                    className="flex flex-wrap items-baseline justify-between gap-2 rounded-md bg-zinc-50 px-3 py-2 text-sm"
                  >
                    <span className="font-semibold text-zinc-900">
                      {e.action.replace(/_/g, " ")}
                      {e.fromStatus || e.toStatus ? (
                        <span className="font-normal text-zinc-500">
                          {" "}
                          ({e.fromStatus ?? "—"} → {e.toStatus ?? "—"})
                        </span>
                      ) : null}
                      {e.note ? (
                        <span className="block text-xs font-normal text-zinc-500">{e.note}</span>
                      ) : null}
                    </span>
                    <span className="text-xs whitespace-nowrap text-zinc-500">
                      {new Date(e.createdAt).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="text-sm text-zinc-500">
            <Link href="/admin/orders" className="font-semibold text-brand-700 hover:underline">
              ← Back to orders
            </Link>
          </p>
        </div>
      )}
    </AdminShell>
  );
}
