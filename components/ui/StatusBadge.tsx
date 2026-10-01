import { Badge } from "@/components/ui/Badge";
import type { OrderStatus, PaymentStatus } from "@/types";

const orderTones: Record<OrderStatus, "info" | "accent" | "success" | "neutral" | "danger"> = {
  draft: "neutral",
  pending_payment: "info",
  paid: "accent",
  confirmed: "accent",
  shipped: "info",
  delivered: "success",
  cancelled: "danger",
};

const orderLabels: Record<OrderStatus, string> = {
  draft: "Draft",
  pending_payment: "Payment pending",
  paid: "Paid",
  confirmed: "Confirmed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const paymentTones: Record<PaymentStatus, "info" | "success" | "danger" | "neutral"> = {
  pending: "info",
  verified: "success",
  failed: "danger",
  refunded: "neutral",
};

const paymentLabels: Record<PaymentStatus, string> = {
  pending: "Pending",
  verified: "Verified",
  failed: "Failed",
  refunded: "Refunded",
};

/** Status pill for admin order/payment tables (reuses Badge tones). */
export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={orderTones[status]}>{orderLabels[status]}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Badge tone={paymentTones[status]}>{paymentLabels[status]}</Badge>;
}

export function StockBadge({ quantity }: { quantity: number }) {
  if (quantity <= 0) return <Badge tone="danger">Out of stock</Badge>;
  if (quantity <= 10) return <Badge tone="warning">Low stock</Badge>;
  return <Badge tone="success">In stock</Badge>;
}
