"use client";

import { useState } from "react";
import { QuantitySelector } from "@/components/ui/QuantitySelector";

export interface AddToCartInput {
  productId: string;
  quantity: number;
}

/**
 * Add-to-cart control: quantity stepper + Add button.
 *
 * This is the cart phase's integration point. Pass `onAdd` and the
 * button adds `{ productId, quantity }` to the cart (state/store owned
 * by the caller); omit it and the button renders honestly disabled
 * until the cart exists. No temporary backend, no fake state.
 */
export function AddToCartControl({
  productId,
  maxQuantity,
  onAdd,
}: {
  productId: string;
  maxQuantity?: number;
  onAdd?: (input: AddToCartInput) => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const max = maxQuantity ?? 999;

  return (
    <div className="flex flex-col gap-3">
      <QuantitySelector
        value={quantity}
        onChange={setQuantity}
        min={1}
        max={max}
        label="Quantity"
      />
      {onAdd ? (
        <button
          type="button"
          onClick={() => onAdd({ productId, quantity })}
          className="inline-flex h-12 cursor-pointer items-center justify-center rounded-md bg-brand-800 px-6 text-base font-bold text-white hover:bg-brand-700"
        >
          Add to Cart
        </button>
      ) : (
        <button
          type="button"
          disabled
          title="Add to cart — coming with the cart phase"
          className="inline-flex h-12 cursor-not-allowed items-center justify-center rounded-md border border-zinc-300 bg-zinc-100 px-6 text-base font-bold text-zinc-400"
        >
          Add to Cart — soon
        </button>
      )}
    </div>
  );
}
