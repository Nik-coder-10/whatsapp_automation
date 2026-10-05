"use client";

import Link from "next/link";
import { AddToCartControl } from "@/components/cart/AddToCartControl";
import { useCart } from "@/components/cart/CartProvider";
import { useToast } from "@/components/ui/Toast";
import type { AddItemInput } from "@/lib/cart/types";
import type { StockStatus } from "@/lib/inventory/availability";

/**
 * Detail-page purchase box: quantity + Add to Cart (wired to the cart
 * store) with a View Cart follow-up. Contact link stays server-side in
 * the page. Out-of-stock products render a disabled box instead — the
 * server still re-checks everything at order time, so this is UX, not
 * enforcement.
 */
export function BuyBox({
  product,
  availability = "in_stock",
}: {
  product: Omit<AddItemInput, "quantity">;
  availability?: StockStatus;
}) {
  const { addItem } = useCart();
  const { notify } = useToast();

  if (availability === "out_of_stock") {
    return (
      <div className="flex flex-col gap-3">
        <button
          type="button"
          disabled
          className="inline-flex h-12 w-full cursor-not-allowed items-center justify-center rounded-md bg-zinc-100 px-6 text-base font-bold text-zinc-400"
        >
          Out of stock
        </button>
        <p className="text-xs leading-5 text-zinc-500">
          This product is currently unavailable. Contact sales for restock
          timelines.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <AddToCartControl
        productId={product.productId}
        maxQuantity={product.stockQuantity > 0 ? product.stockQuantity : undefined}
        onAdd={({ quantity }) => {
          addItem({ ...product, quantity });
          notify(`${product.name} × ${quantity} added to cart.`, "success");
        }}
      />
      <Link
        href="/cart"
        className="inline-flex h-11 items-center justify-center rounded-md border border-zinc-300 bg-white px-6 text-sm font-bold text-zinc-800 hover:bg-zinc-50"
      >
        View Cart
      </Link>
    </div>
  );
}
