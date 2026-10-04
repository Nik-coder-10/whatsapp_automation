import { createClient } from "@/lib/supabase/server";
import { isValidPincode, normalizePincode } from "@/lib/validations/common";
import { AppError } from "@/lib/api/errors";
import type { PincodeRateWithPartner } from "@/types/database";
import type { ServiceabilityResult } from "@/types";

/**
 * Delivery-partner serviceability, read from
 * public.delivery_pincode_rates (RLS allows anon/authenticated SELECT,
 * so the plain server client is sufficient — no service-role needed).
 *
 * Server-side only: never expose raw rate tables to the browser.
 * Order-size windows (min/max_order_amount) are applied at checkout
 * time in a later phase; this check answers "can we deliver here,
 * and who is cheapest" only.
 */
export interface ServiceabilityQuery {
  pincode: string;
}

export async function checkServiceability(
  query: ServiceabilityQuery,
): Promise<ServiceabilityResult> {
  const pincode = normalizePincode(query.pincode);
  if (!isValidPincode(pincode)) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Enter a valid 6-digit delivery pincode.",
      422,
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("delivery_pincode_rates")
    .select(
      "id, pincode, delivery_partner_id, serviceable, delivery_charge," +
        "min_order_amount, max_order_amount, eta_min_days, eta_max_days," +
        "created_at, updated_at, delivery_partners!inner(name, is_active)",
    )
    .eq("pincode", pincode);

  if (error) {
    throw new AppError(
      "INTERNAL_ERROR",
      "Could not check delivery availability. Please try again.",
      500,
    );
  }

  // Untyped client (no generated Database type yet): narrow via unknown.
  const rows = (data ?? []) as unknown as PincodeRateWithPartner[];
  if (rows.length === 0) {
    return {
      pincode,
      serviceable: false,
      reason: "Delivery is not available for this pincode yet.",
    };
  }

  const options = rows.filter(
    (r) => r.serviceable && (r.delivery_partners?.is_active ?? false),
  );
  if (options.length === 0) {
    return {
      pincode,
      serviceable: false,
      reason: "Our delivery partners do not serve this pincode yet.",
    };
  }

  // Cheapest serviceable partner wins. NUMERIC arrives as a decimal
  // string with ≤2 places, so Number() comparison is exact here.
  const best = options.reduce((a, b) =>
    Number(a.delivery_charge) <= Number(b.delivery_charge) ? a : b,
  );
  const partnerName = best.delivery_partners?.name ?? "Delivery partner";

  return {
    pincode,
    serviceable: true,
    deliveryPartner: partnerName,
    deliveryChargePaise: Math.round(Number(best.delivery_charge) * 100),
    ...(best.eta_min_days !== null && best.eta_max_days !== null
      ? { etaDays: { min: best.eta_min_days, max: best.eta_max_days } }
      : {}),
  };
}
