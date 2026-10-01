import { describe, expect, it } from "vitest";
import {
  addMoney,
  formatMoney,
  paise,
  sumTotals,
  zeroMoney,
} from "@/lib/orders/pricing";
import { priceToPaise } from "@/lib/catalog/products";

describe("paise-integer money", () => {
  it("converts rupees without float drift", () => {
    expect(paise(24999).amountPaise).toBe(2499900);
    expect(priceToPaise("24999.00")).toBe(2499900);
    expect(priceToPaise("285000.00")).toBe(28500000);
  });

  it("formats en-IN rupees", () => {
    expect(formatMoney(paise(24999))).toBe("₹24,999.00");
    expect(formatMoney(paise(285000))).toBe("₹2,85,000.00");
    expect(formatMoney(zeroMoney())).toBe("₹0.00");
  });

  it("adds and sums without float math", () => {
    expect(addMoney(paise(100), paise(0.1)).amountPaise).toBe(10010);
    expect(sumTotals([paise(100), paise(200.5)]).amountPaise).toBe(30050);
  });

  it("rejects currency mismatch", () => {
    expect(() =>
      addMoney(paise(1), { amountPaise: 1, currency: "USD" as "INR" }),
    ).toThrow();
  });
});
