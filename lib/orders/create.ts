import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/api/errors";
import type { OrderQuote } from "@/lib/orders/quote";

/**
 * Order persistence via the atomic create_order() RPC (server-only).
 *
 * Snapshots come exclusively from a server-computed OrderQuote — this
 * module accepts no money from callers. Concurrent double-submits with
 * the same idempotency key resolve to the existing order via the
 * UNIQUE constraint (23505 → fetch-and-return).
 */

export interface PersistedOrder {
  orderId: string;
  duplicate: boolean;
}

const toRupees = (paise: number): string => (paise / 100).toFixed(2);

export async function persistOrder(input: {
  idempotencyKey: string;
  customer: {
    name: string;
    phone: string;
    email: string | null;
    gstin: string | null;
  };
  quote: OrderQuote;
}): Promise<PersistedOrder> {
  const admin = createAdminClient();
  const { quote } = input;

  const payload = {
    p_idempotency_key: input.idempotencyKey,
    p_customer: {
      name: input.customer.name,
      phone: input.customer.phone,
      email: input.customer.email,
      gstin: input.customer.gstin,
    },
    p_order: {
      order_number: "",
      subtotal: toRupees(quote.subtotalPaise),
      delivery_charge: toRupees(quote.deliveryChargePaise),
      total_amount: toRupees(quote.subtotalPaise + quote.deliveryChargePaise),
      delivery_pincode: quote.pincode,
      delivery_partner_id: quote.deliveryPartnerId,
      delivery_partner_name: quote.deliveryPartnerName,
      gstin_snapshot: input.customer.gstin,
      payment_status: "pending",
      order_status: "pending_payment",
    },
    p_items: quote.lines.map((l) => ({
      product_id: l.productId,
      product_name: l.productName,
      quantity: l.quantity,
      unit_price: toRupees(l.unitPricePaise),
      line_total: toRupees(l.lineTotalPaise),
    })),
    p_payment: {
      amount: toRupees(quote.subtotalPaise + quote.deliveryChargePaise),
      method: "upi",
    },
  };

  const { data, error } = await admin.rpc("create_order", payload);
  if (!error) {
    return { orderId: data as unknown as string, duplicate: false };
  }
  // Concurrent race: another request won with the same key.
  if ((error as { code?: string }).code === "23505") {
    const existing = await admin
      .from("orders")
      .select("id")
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();
    const row = existing.data as unknown as { id: string } | null;
    if (!existing.error && row) {
      return { orderId: row.id, duplicate: true };
    }
  }
  throw new AppError(
    "INTERNAL_ERROR",
    "Could not place this order. Please try again.",
    500,
  );
}

export interface OrderSummary {
  id: string;
  orderNumber: string;
  subtotalPaise: number;
  deliveryChargePaise: number;
  totalPaise: number;
  paymentStatus: string;
  orderStatus: string;
}

/** Customer-safe order summary (no internal rows leak). */
export async function fetchOrderSummary(orderId: string): Promise<OrderSummary> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("orders")
    .select(
      "id,order_number,subtotal,delivery_charge,total_amount,payment_status,order_status",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (error || !data) {
    throw new AppError(
      "INTERNAL_ERROR",
      "Could not load this order. Please try again.",
      500,
    );
  }
  const row = data as unknown as {
    id: string;
    order_number: string;
    subtotal: string;
    delivery_charge: string;
    total_amount: string;
    payment_status: string;
    order_status: string;
  };
  return {
    id: row.id,
    orderNumber: row.order_number,
    subtotalPaise: Math.round(Number(row.subtotal) * 100),
    deliveryChargePaise: Math.round(Number(row.delivery_charge) * 100),
    totalPaise: Math.round(Number(row.total_amount) * 100),
    paymentStatus: row.payment_status,
    orderStatus: row.order_status,
  };
}
