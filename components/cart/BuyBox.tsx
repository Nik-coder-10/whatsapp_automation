"use client";

import Link from "next/link";
import { AddToCartControl } from "@/components/cart/AddToCartControl";
import { useCart } from "@/components/cart/CartProvider";
import { useToast } from "@/components/ui/Toast";
import type { AddItemInput } from "@/lib/cart/types";

/**
 * Detail-page purchase box: quantity + Add to Cart (wired to the cart
 * store) with a View Cart follow-up. Contact link stays server-side in
 * the page. This is the cart phase's `onAdd` integration in action.
 */
export function BuyBox({ product }: { product: Omit<AddItemInput, "quantity"> }) {
  const { addItem } = useCart();
  const { notify } = useToast();

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
