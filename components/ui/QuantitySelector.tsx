"use client";

import { useId } from "react";

/**
 * Quantity stepper for product pages / cart rows (presentational:
 * parent owns the value via onChange). Buttons are real <button>s,
 * the input is labelled, changes announced via aria-live.
 */
export function QuantitySelector({
  value,
  onChange,
  min = 1,
  max = 999,
  label = "Quantity",
  small = false,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  label?: string;
  small?: boolean;
}) {
  const inputId = useId();
  const clamp = (n: number) =>
    Math.min(max, Math.max(min, Number.isFinite(n) ? Math.floor(n) : min));
  const btn = small ? "h-8 w-8 text-base" : "h-11 w-11 text-lg";

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-semibold text-zinc-800">
        {label}
      </label>
      <div className="flex items-stretch" role="group" aria-label={label}>
        <button
          type="button"
          aria-label="Decrease quantity"
          disabled={value <= min}
          onClick={() => onChange(clamp(value - 1))}
          className={`cursor-pointer rounded-l-md border border-zinc-300 bg-white font-bold text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:text-zinc-300 ${btn}`}
        >
          −
        </button>
        <input
          id={inputId}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value}
          aria-live="polite"
          onChange={(e) => onChange(clamp(Number(e.target.value)))}
          className={`border-y border-zinc-300 bg-white text-center font-semibold text-zinc-900 outline-none focus:border-brand-700 ${
            small ? "h-8 w-12 text-sm" : "h-11 w-16 text-base"
          } [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
        />
        <button
          type="button"
          aria-label="Increase quantity"
          disabled={value >= max}
          onClick={() => onChange(clamp(value + 1))}
          className={`cursor-pointer rounded-r-md border border-zinc-300 bg-white font-bold text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:text-zinc-300 ${btn}`}
        >
          +
        </button>
      </div>
    </div>
  );
}
