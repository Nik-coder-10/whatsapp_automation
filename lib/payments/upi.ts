import "server-only";

/**
 * Owner UPI payment config (server-only).
 *
 * Customers pay to the owner's UPI id; verification happens server-side
 * (reference/UTR reconciliation in the admin dashboard). Never accept a
 * "payment successful" flag from the browser as proof of payment.
 */

export interface UpiPaymentInfo {
  payeeVpa: string;
  payeeName: string;
}

export function getOwnerUpi(): UpiPaymentInfo {
  const payeeVpa = process.env.OWNER_UPI_ID ?? "";
  const payeeName = process.env.OWNER_UPI_PAYEE_NAME ?? "Trolift Solutions";
  if (payeeVpa === "") {
    throw new Error("[payments] OWNER_UPI_ID is not configured. See .env.example.");
  }
  return { payeeVpa, payeeName };
}

/** UPI deep-link for QR/intent (amount in rupees, VPA validated). */
export function buildUpiIntent(info: UpiPaymentInfo, amountRupees: number, note: string): string {
  const params = new URLSearchParams({
    pa: info.payeeVpa,
    pn: info.payeeName,
    am: amountRupees.toFixed(2),
    cu: "INR",
    tn: note.slice(0, 80),
  });
  return `upi://pay?${params.toString()}`;
}
