import { describe, expect, it } from "vitest";
import {
  addItem,
  clearCart,
  countItems,
  estimateSubtotal,
  parseStoredCart,
  removeItem,
  setQuantity,
} from "@/lib/cart/store";
import type { AddItemInput } from "@/lib/cart/types";

const TROLLEY: AddItemInput = {
  productId: "p1",
  slug: "trolley",
  name: "Platform Trolley",
  category: "Trolleys",
  pricePaise: 629900,
  image: "/images/products/placeholder.svg",
  stockQuantity: 120,
  quantity: 2,
};

describe("cart operations (pure, no storage)", () => {
  it("adds new items and merges repeats", () => {
    const one = addItem([], TROLLEY);
    expect(one).toHaveLength(1);
    expect(one[0]?.quantity).toBe(2);
    const two = addItem(one, { ...TROLLEY, quantity: 3 });
    expect(two).toHaveLength(1);
    expect(two[0]?.quantity).toBe(5);
  });

  it("clamps quantities to stock and minimum 1", () => {
    expect(addItem([], { ...TROLLEY, quantity: 9999 })[0]?.quantity).toBe(120);
    expect(addItem([], { ...TROLLEY, quantity: 0 })[0]?.quantity).toBe(1);
    expect(setQuantity(addItem([], TROLLEY), "p1", -4)[0]?.quantity).toBe(1);
  });

  it("sets, removes and clears", () => {
    const items = addItem([], TROLLEY);
    expect(setQuantity(items, "p1", 4)[0]?.quantity).toBe(4);
    expect(setQuantity(items, "missing", 4)).toEqual(items);
    expect(removeItem(items, "p1")).toHaveLength(0);
    expect(clearCart()).toEqual([]);
  });

  it("counts units and estimates subtotals in paise", () => {
    const items = addItem(addItem([], TROLLEY), {
      ...TROLLEY,
      productId: "p2",
      pricePaise: 10000,
      quantity: 1,
    });
    expect(countItems(items)).toBe(3);
    expect(estimateSubtotal(items)).toBe(629900 * 2 + 10000);
  });

  it("rejects corrupt persisted payloads", () => {
    expect(parseStoredCart(null)).toEqual([]);
    expect(parseStoredCart([{ nope: true }, null, 42])).toEqual([]);
    expect(
      parseStoredCart([
        { ...TROLLEY, pricePaise: "oops", quantity: 2, stockQuantity: 5 },
      ]),
    ).toEqual([]);
  });
});
