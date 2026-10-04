import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OrderStatus, PaymentStatus } from "@/types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Payment-page view model (server-only). Order UUIDs are unguessable
 * capability links, so no login is required to view one's own order —
 * but only this safe projection is ever returned, never raw rows.
 */

export interface PayableOrderItem {
  name: string;
  quantity: number;
  lineTotalPaise: number;
}

export interface PayableOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  subtotalPaise: number;
  deliveryChargePaise: number;
  totalPaise: number;
  items: PayableOrderItem[];
  paymentReference: string | null;
  createdAt: string;
}

const toPaise = (decimal: string): number =>
  Math.round(Number(decimal) * 100);

export async function getPayableOrder(
  orderId: string,
): Promise<PayableOrder | null> {
  if (!UUID_RE.test(orderId)) return null;
  const admin = createAdminClient();

  const { data: order, error: orderError } = await admin
    .from("orders")
    .select(
      "id,order_number,customer_id,subtotal,delivery_charge,total_amount," +
        "payment_status,order_status,created_at",
    )
    .eq("id", orderId)
    .maybeSingle();
  const o = order as unknown as {
    id: string;
    order_number: string;
    customer_id: string;
    subtotal: string;
    delivery_charge: string;
    total_amount: string;
    payment_status: PaymentStatus;
    order_status: OrderStatus;
    created_at: string;
  } | null;
  if (orderError || !o) return null;

  const [{ data: customer }, { data: items }, { data: payment }] =
    await Promise.all([
      admin.from("customers").select("name").eq("id", o.customer_id).maybeSingle(),
      admin
        .from("order_items")
        .select("product_name,quantity,line_total")
        .eq("order_id", o.id)
        .order("product_name"),
      admin
        .from("payments")
        .select("transaction_reference,status")
        .eq("order_id", o.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
  const c = customer as unknown as { name: string } | null;
  const rows = (items ?? []) as unknown as Array<{
    product_name: string;
    quantity: number;
    line_total: string;
  }>;
  const p = payment as unknown as {
    transaction_reference: string | null;
    status: PaymentStatus;
  } | null;

  return {
    id: o.id,
    orderNumber: o.order_number,
    customerName: c?.name ?? "Customer",
    orderStatus: o.order_status,
    paymentStatus: p?.status ?? o.payment_status,
    subtotalPaise: toPaise(o.subtotal),
    deliveryChargePaise: toPaise(o.delivery_charge),
    totalPaise: toPaise(o.total_amount),
    items: rows.map((r) => ({
      name: r.product_name,
      quantity: r.quantity,
      lineTotalPaise: toPaise(r.line_total),
    })),
    paymentReference: p?.transaction_reference ?? null,
    createdAt: o.created_at,
  };
}
