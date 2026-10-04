import type { AddItemInput, CartItem, CartItems } from "@/lib/cart/types";

export const CART_MAX_QTY = 999;

const clampQty = (n: number, stock: number): number => {
  if (!Number.isFinite(n)) return 1;
  return Math.min(Math.max(1, Math.floor(n)), Math.max(1, Math.min(stock, CART_MAX_QTY)));
};

function toItem(input: AddItemInput): CartItem {
  return {
    productId: input.productId,
    slug: input.slug,
    name: input.name,
    category: input.category,
    pricePaise: Math.max(0, Math.round(input.pricePaise)),
    image: input.image,
    stockQuantity: Math.max(0, Math.floor(input.stockQuantity)),
    quantity: 1,
  };
}

/** Pure cart operations — unit-tested, no storage side effects. */
export function addItem(items: CartItems, input: AddItemInput): CartItems {
  const base = toItem(input);
  const qty = clampQty(input.quantity, base.stockQuantity);
  const existing = items.find((i) => i.productId === base.productId);
  if (!existing) return [...items, { ...base, quantity: qty }];
  const stock = Math.max(existing.stockQuantity, base.stockQuantity);
  return items.map((i) =>
    i.productId === base.productId
      ? {
          ...i,
          // Refresh display snapshot; keep the tightest known stock cap.
          name: base.name,
          pricePaise: base.pricePaise,
          image: base.image,
          stockQuantity: stock,
          quantity: clampQty(i.quantity + qty, stock),
        }
      : i,
  );
}

export function setQuantity(
  items: CartItems,
  productId: string,
  quantity: number,
): CartItems {
  const existing = items.find((i) => i.productId === productId);
  if (!existing) return items;
  return items.map((i) =>
    i.productId === productId
      ? { ...i, quantity: clampQty(quantity, i.stockQuantity) }
      : i,
  );
}

export function removeItem(items: CartItems, productId: string): CartItems {
  return items.filter((i) => i.productId !== productId);
}

export function clearCart(): CartItems {
  return [];
}

export function countItems(items: CartItems): number {
  return items.reduce((n, i) => n + i.quantity, 0);
}

/**
 * Display-only estimate in paise. Final totals are computed server-side
 * at checkout — this number must never be treated as an order total.
 */
export function estimateSubtotal(items: CartItems): number {
  return items.reduce((n, i) => n + i.pricePaise * i.quantity, 0);
}

/** Parse persisted cart defensively (corrupt data → empty cart). */
export function parseStoredCart(value: unknown): CartItems {
  if (!Array.isArray(value)) return [];
  const out: CartItems = [];
  for (const raw of value) {
    if (typeof raw !== "object" || raw === null) continue;
    const r = raw as Record<string, unknown>;
    if (
      typeof r["productId"] !== "string" ||
      typeof r["slug"] !== "string" ||
      typeof r["name"] !== "string" ||
      typeof r["category"] !== "string" ||
      typeof r["pricePaise"] !== "number" ||
      typeof r["image"] !== "string" ||
      typeof r["stockQuantity"] !== "number" ||
      typeof r["quantity"] !== "number"
    ) {
      continue;
    }
    out.push({
      productId: r["productId"],
      slug: r["slug"],
      name: r["name"],
      category: r["category"],
      pricePaise: Math.max(0, Math.round(r["pricePaise"])),
      image: r["image"],
      stockQuantity: Math.max(0, Math.floor(r["stockQuantity"])),
      quantity: clampQty(r["quantity"], Math.max(0, Math.floor(r["stockQuantity"]))),
    });
  }
  return out;
}
