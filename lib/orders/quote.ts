import "server-only";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/api/errors";
import { quoteDelivery } from "@/lib/delivery/engine";

/**
 * Server-side order pricing (server-only).
 *
 * Accepts ONLY product IDs, quantities and a pincode — never prices,
 * charges or totals. Every rupee below is recomputed from trusted
 * product rows plus the delivery engine, so client-submitted money is
 * structurally impossible to honour.
 *
 *   subtotal = Σ(unit_price × quantity)      (integer paise)
 *   delivery = delivery_engine(pincode, subtotal)
 *   total    = subtotal + delivery
 */

export interface OrderLineInput {
  productId: string;
  quantity: number;
}

export interface PricedOrderLine {
  productId: string;
  productName: string;
  quantity: number;
  /** Integer paise snapshot from the live product row. */
  unitPricePaise: number;
  lineTotalPaise: number;
}

export interface OrderQuote {
  lines: PricedOrderLine[];
  subtotalPaise: number;
  deliveryPartnerId: string;
  deliveryPartnerName: string;
  deliveryChargePaise: number;
  totalPaise: number;
  pincode: string;
}

interface ProductRow {
  id: string;
  name: string;
  price: string;
  is_active: boolean;
}

export const ORDER_MAX_QTY = 999;

/**
 * Pure line pricing over already-fetched product rows.
 * Throws 422 on unknown/inactive products and bad quantities.
 */
export function priceOrderLines(
  products: ProductRow[],
  items: OrderLineInput[],
): PricedOrderLine[] {
  if (items.length === 0) {
    throw new AppError("VALIDATION_ERROR", "The order has no items.", 422);
  }
  const byId = new Map(products.map((p) => [p.id, p]));
  return items.map((item) => {
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Quantities must be whole numbers of at least 1.",
        422,
      );
    }
    if (item.quantity > ORDER_MAX_QTY) {
      throw new AppError(
        "VALIDATION_ERROR",
        `Quantities are limited to ${ORDER_MAX_QTY} per product.`,
        422,
      );
    }
    const product = byId.get(item.productId);
    if (!product || !product.is_active) {
      throw new AppError(
        "VALIDATION_ERROR",
        "One of the products is no longer available.",
        422,
      );
    }
    const unitPricePaise = Math.round(Number(product.price) * 100);
    if (!Number.isFinite(unitPricePaise) || unitPricePaise < 0) {
      throw new AppError("INTERNAL_ERROR", "Invalid product price.", 500);
    }
    return {
      productId: product.id,
      productName: product.name,
      quantity: item.quantity,
      unitPricePaise,
      lineTotalPaise: unitPricePaise * item.quantity,
    };
  });
}

/**
 * Full server quote: trusted prices → subtotal → engine delivery → total.
 * The future order API calls this (then persists snapshots + CHECKs).
 */
export async function quoteOrder(input: {
  items: OrderLineInput[];
  pincode: string;
}): Promise<OrderQuote> {
  const supabase = await createClient();
  const ids = [...new Set(input.items.map((i) => i.productId))];
  const { data, error } = await supabase
    .from("products")
    .select("id,name,price,is_active")
    .in("id", ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"]);
  if (error) {
    throw new AppError(
      "INTERNAL_ERROR",
      "Could not price this order. Please try again.",
      500,
    );
  }
  const lines = priceOrderLines(
    (data ?? []) as unknown as ProductRow[],
    input.items,
  );
  const subtotalPaise = lines.reduce((n, l) => n + l.lineTotalPaise, 0);

  const delivery = await quoteDelivery(input.pincode, subtotalPaise);
  if (!delivery.serviceable || !delivery.selected) {
    throw new AppError(
      "VALIDATION_ERROR",
      delivery.reason ?? "This pincode is not serviceable.",
      422,
    );
  }
  return {
    lines,
    subtotalPaise,
    deliveryPartnerId: delivery.selected.partner.id,
    deliveryPartnerName: delivery.selected.partner.name,
    deliveryChargePaise: delivery.selected.deliveryChargePaise,
    totalPaise: subtotalPaise + delivery.selected.deliveryChargePaise,
    pincode: delivery.pincode,
  };
}
