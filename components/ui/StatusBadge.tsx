import { Badge } from "@/components/ui/Badge";
import type { OrderStatus, PaymentStatus } from "@/types";

const orderTones: Record<OrderStatus, "info" | "accent" | "success" | "neutral" | "danger"> = {
  draft: "neutral",
  pending_payment: "info",
  payment_submitted: "accent",
  paid: "accent",
  confirmed: "success",
  processing: "info",
  shipped: "info",
  dispatched: "info",
  delivered: "success",
  cancelled: "danger",
};

const orderLabels: Record<OrderStatus, string> = {
  draft: "Draft",
  pending_payment: "Payment pending",
  payment_submitted: "Payment submitted",
  paid: "Paid",
  confirmed: "Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  dispatched: "Dispatched",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const paymentTones: Record<PaymentStatus, "info" | "success" | "danger" | "neutral" | "accent"> = {
  pending: "info",
  submitted: "accent",
  paid: "success",
  failed: "danger",
  cancelled: "neutral",
  refunded: "neutral",
};

const paymentLabels: Record<PaymentStatus, string> = {
  pending: "Pending",
  submitted: "Submitted",
  paid: "Paid",
  failed: "Failed",
  cancelled: "Cancelled",
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
