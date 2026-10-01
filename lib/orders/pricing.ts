import { CURRENCY_SYMBOL } from "@/config/constants";
import type { Money, OrderTotals } from "@/types";

/**
 * Money helpers. All amounts are integer paise — never floats.
 * Totals are computed server-side from trusted product/charge rows;
 * browser-submitted totals are ignored and recomputed.
 */

export function paise(rupees: number): Money {
  return { amountPaise: Math.round(rupees * 100), currency: "INR" };
}

export function zeroMoney(): Money {
  return { amountPaise: 0, currency: "INR" };
}

export function formatMoney(m: Money): string {
  return `${CURRENCY_SYMBOL}${(m.amountPaise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) throw new Error("[orders] Currency mismatch.");
  return { amountPaise: a.amountPaise + b.amountPaise, currency: a.currency };
}

export function sumTotals(parts: Money[]): Money {
  return parts.reduce<Money>(addMoney, zeroMoney());
}

/** Placeholder shape — real computation lands with products/charges data. */
export function emptyTotals(): OrderTotals {
  return {
    subtotal: zeroMoney(),
    deliveryCharge: zeroMoney(),
    tax: zeroMoney(),
    grandTotal: zeroMoney(),
  };
}
