"use client";

import type { PayableOrder } from "@/lib/payments/order";

/**
 * Print + download actions for an order. The download is generated
 * locally from the already-displayed snapshot data — no server call,
 * no new totals.
 */
export function OrderActions({ order }: { order: PayableOrder }) {
  const download = () => {
    const lines = [
      `Trolift Solutions — Order ${order.orderNumber}`,
      `Status: ${order.orderStatus} | Payment: ${order.paymentStatus}`,
      "",
      ...order.items.map(
        (i) =>
          `${i.name} x ${i.quantity} — ${(i.lineTotalPaise / 100).toFixed(2)} INR`,
      ),
      "",
      `Subtotal: ${(order.subtotalPaise / 100).toFixed(2)} INR`,
      `Delivery (${order.deliveryPartnerName}): ${(order.deliveryChargePaise / 100).toFixed(2)} INR`,
      `Total: ${(order.totalPaise / 100).toFixed(2)} INR`,
      `Pincode: ${order.deliveryPincode}`,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${order.orderNumber}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex h-10 cursor-pointer items-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-bold text-zinc-800 hover:bg-zinc-50"
      >
        Print order
      </button>
      <button
        type="button"
        onClick={download}
        className="inline-flex h-10 cursor-pointer items-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-bold text-zinc-800 hover:bg-zinc-50"
      >
        Download summary
      </button>
    </div>
  );
}
