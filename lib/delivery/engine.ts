import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isValidPincode, normalizePincode } from "@/lib/validations/common";
import { AppError } from "@/lib/api/errors";

/**
 * Production delivery engine (server-only).
 *
 * One question in, one authoritative answer out: is this pincode
 * serviceable, by whom, for how much. The browser may ask
 * "check this pincode" — it never decides the charge.
 *
 * SELECTION STRATEGY (in order, easy to change here in one place):
 *   1. Only active partners with serviceable rate rows qualify.
 *   2. Lowest partner `priority` wins (lower number = preferred).
 *   3. Ties break on the lowest delivery charge.
 *
 * EXTENSION POINTS (no checkout rewrite needed):
 *   - min/max order windows: enforced below when a subtotal is given.
 *   - per-pincode priority, weight slabs, remote surcharges: add columns
 *     to delivery_pincode_rates and extend `RateOption` + this selector.
 */

export interface RateOption {
  partnerId: string;
  partnerName: string;
  /** Lower wins. From delivery_partners.priority (default 100). */
  partnerPriority: number;
  /** Integer paise, converted from NUMERIC(12,2) — exact. */
  deliveryChargePaise: number;
  etaDays?: { min: number; max: number };
  minOrderPaise: number | null;
  maxOrderPaise: number | null;
}

export interface DeliveryPartnerRef {
  id: string;
  name: string;
}

export interface DeliveryQuote {
  pincode: string;
  serviceable: boolean;
  selected: {
    partner: DeliveryPartnerRef;
    deliveryChargePaise: number;
    etaDays?: { min: number; max: number };
  } | null;
  /** All viable options, selection order (price-transparent UI). */
  options: Array<{
    partner: DeliveryPartnerRef;
    deliveryChargePaise: number;
  }>;
  reason?: string;
}

/** Pure selection — unit-tested, no I/O. */
export function selectDeliveryOption(
  options: RateOption[],
): RateOption | null {
  const viable = options.filter((o) => o.deliveryChargePaise >= 0);
  if (viable.length === 0) return null;
  const [best] = [...viable].sort(
    (a, b) =>
      a.partnerPriority - b.partnerPriority ||
      a.deliveryChargePaise - b.deliveryChargePaise,
  );
  return best ?? null;
}

/** Order-window gate. Skipped when no subtotal is given (see below). */
export function withinOrderWindow(
  option: RateOption,
  subtotalPaise: number,
): boolean {
  if (option.minOrderPaise !== null && subtotalPaise < option.minOrderPaise) {
    return false;
  }
  if (option.maxOrderPaise !== null && subtotalPaise > option.maxOrderPaise) {
    return false;
  }
  return true;
}

interface RateRow {
  delivery_partner_id: string;
  serviceable: boolean;
  delivery_charge: string;
  eta_min_days: number | null;
  eta_max_days: number | null;
  min_order_amount: string | null;
  max_order_amount: string | null;
  delivery_partners: { name: string; is_active: boolean; priority: number } | null;
}

const toPaise = (decimal: string): number => Math.round(Number(decimal) * 100);

/**
 * Quote delivery for a pincode. Pass the order subtotal (paise) so
 * min/max order windows apply; omit it for a pure coverage check
 * (windows are then enforced later with the real subtotal).
 */
export async function quoteDelivery(
  rawPincode: string,
  subtotalPaise?: number,
): Promise<DeliveryQuote> {
  const pincode = normalizePincode(rawPincode);
  if (!isValidPincode(pincode)) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Enter a valid 6-digit delivery pincode.",
      422,
    );
  }
  if (
    subtotalPaise !== undefined &&
    (!Number.isInteger(subtotalPaise) || subtotalPaise < 0)
  ) {
    throw new AppError("VALIDATION_ERROR", "Invalid order subtotal.", 422);
  }

  // Indexed pincode lookup (pincode_rates_pincode_idx) — one narrow
  // query, never a table scan.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("delivery_pincode_rates")
    .select(
      "delivery_partner_id, serviceable, delivery_charge," +
        "eta_min_days, eta_max_days, min_order_amount, max_order_amount," +
        "delivery_partners!inner(name, is_active, priority)",
    )
    .eq("pincode", pincode);

  if (error) {
    throw new AppError(
      "INTERNAL_ERROR",
      "Could not check delivery availability. Please try again.",
      500,
    );
  }

  const rows = (data ?? []) as unknown as RateRow[];
  if (rows.length === 0) {
    return {
      pincode,
      serviceable: false,
      selected: null,
      options: [],
      reason: "Delivery is not available for this pincode yet.",
    };
  }

  const candidates: RateOption[] = rows
    .filter((r) => r.serviceable && (r.delivery_partners?.is_active ?? false))
    .map((r) => ({
      partnerId: r.delivery_partner_id,
      partnerName: r.delivery_partners?.name ?? "Delivery partner",
      partnerPriority: r.delivery_partners?.priority ?? 100,
      deliveryChargePaise: toPaise(r.delivery_charge),
      ...(r.eta_min_days !== null && r.eta_max_days !== null
        ? { etaDays: { min: r.eta_min_days, max: r.eta_max_days } }
        : {}),
      minOrderPaise:
        r.min_order_amount === null ? null : toPaise(r.min_order_amount),
      maxOrderPaise:
        r.max_order_amount === null ? null : toPaise(r.max_order_amount),
    }))
    .filter((o) =>
      subtotalPaise === undefined ? true : withinOrderWindow(o, subtotalPaise),
    );

  if (candidates.length === 0) {
    return {
      pincode,
      serviceable: false,
      selected: null,
      options: [],
      reason: "Our delivery partners do not serve this pincode yet.",
    };
  }

  const selected = selectDeliveryOption(candidates);
  if (!selected) {
    return {
      pincode,
      serviceable: false,
      selected: null,
      options: [],
      reason: "No valid delivery option for this pincode.",
    };
  }

  const ordered = [...candidates].sort(
    (a, b) =>
      a.partnerPriority - b.partnerPriority ||
      a.deliveryChargePaise - b.deliveryChargePaise,
  );
  return {
    pincode,
    serviceable: true,
    selected: {
      partner: { id: selected.partnerId, name: selected.partnerName },
      deliveryChargePaise: selected.deliveryChargePaise,
      ...(selected.etaDays ? { etaDays: selected.etaDays } : {}),
    },
    options: ordered.map((o) => ({
      partner: { id: o.partnerId, name: o.partnerName },
      deliveryChargePaise: o.deliveryChargePaise,
    })),
  };
}
