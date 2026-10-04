import type { OrderStatus } from "@/types";

/**
 * Order lifecycle transitions (pure, unit-tested).
 *
 * Canonical customer-visible flow:
 *   pending_payment → payment_submitted → confirmed → processing →
 *   dispatched → delivered
 * Legacy/edge states (draft/paid/shipped) sit on the same spine and
 * move forward identically. Cancellation is customer-initiated only
 * before fulfilment starts (draft/pending_payment/payment_submitted);
 * everything later is admin-controlled. Terminal states (delivered,
 * cancelled) have no exits.
 *
 * Enforced wherever statuses change server-side (claim API now, admin
 * mutations next) so arbitrary jumps are structurally impossible.
 */

type TransitionMap = Record<OrderStatus, ReadonlyArray<OrderStatus>>;

const CUSTOMER_CANCELLABLE: ReadonlyArray<OrderStatus> = [
  "draft",
  "pending_payment",
  "payment_submitted",
];

export const ORDER_TRANSITIONS: TransitionMap = {
  draft: ["pending_payment", "payment_submitted", "cancelled"],
  pending_payment: ["payment_submitted", "cancelled"],
  payment_submitted: ["confirmed", "cancelled"],
  paid: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["dispatched", "cancelled"],
  shipped: ["dispatched", "cancelled"],
  dispatched: ["delivered"],
  delivered: [],
  cancelled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

/** True when the customer may still cancel (pre-fulfilment). */
export function isCustomerCancellable(status: OrderStatus): boolean {
  return (CUSTOMER_CANCELLABLE as ReadonlyArray<OrderStatus>).includes(status);
}

/** True for end states with no onward movement. */
export function isTerminalStatus(status: OrderStatus): boolean {
  return ORDER_TRANSITIONS[status].length === 0;
}
