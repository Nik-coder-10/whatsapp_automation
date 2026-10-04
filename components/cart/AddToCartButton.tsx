"use client";

import { useCart } from "@/components/cart/CartProvider";
import { useToast } from "@/components/ui/Toast";
import type { AddItemInput } from "@/lib/cart/types";

/**
 * Compact Add button for ProductCard's `actions` slot. Adds one unit
 * (or the given quantity) and confirms via toast — no popups.
 */
export function AddToCartButton({
  product,
  quantity = 1,
}: {
  product: Omit<AddItemInput, "quantity">;
  quantity?: number;
}) {
  const { addItem } = useCart();
  const { notify } = useToast();

  return (
    <button
      type="button"
      aria-label={`Add ${product.name} to cart`}
      onClick={() => {
        addItem({ ...product, quantity });
        notify(`${product.name} added to cart.`, "success");
      }}
      className="inline-flex h-11 shrink-0 cursor-pointer items-center rounded-md bg-amber-400 px-4 text-sm font-bold text-brand-950 hover:bg-amber-300"
    >
      Add
    </button>
  );
}
