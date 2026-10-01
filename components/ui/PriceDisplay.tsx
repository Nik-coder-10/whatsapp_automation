import { formatMoney } from "@/lib/orders/pricing";

/**
 * B2B price display: large en-IN rupee figure with an optional
 * per-unit note ("per piece", "excl. GST", …). amounts in paise.
 */
export function PriceDisplay({
  amountPaise,
  unitNote,
  size = "md",
}: {
  amountPaise: number;
  unitNote?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: "text-base",
    md: "text-xl",
    lg: "text-3xl",
  } as const;
  return (
    <p className="flex flex-wrap items-baseline gap-x-2">
      <span className={`font-bold tracking-tight text-zinc-900 ${sizes[size]}`}>
        {formatMoney({ amountPaise, currency: "INR" })}
      </span>
      {unitNote ? (
        <span className="text-xs font-medium text-zinc-500">{unitNote}</span>
      ) : null}
    </p>
  );
}
