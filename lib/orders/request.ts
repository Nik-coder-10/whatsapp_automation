import { AppError } from "@/lib/api/errors";
import {
  normalizeCheckoutForm,
  validateCheckoutForm,
  type CheckoutFormData,
} from "@/lib/checkout/validation";
import { ORDER_MAX_QTY } from "@/lib/orders/quote";

/**
 * Order request parsing + validation (pure, unit-tested).
 *
 * Accepts ONLY: item IDs + quantities, customer details, pincode and an
 * idempotency key. There is deliberately no field for prices, charges,
 * totals, partner, payment status or order status — the server derives
 * all of those, so a hostile client cannot even submit fakes.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface OrderRequestItem {
  productId: string;
  quantity: number;
}

export interface ParsedOrderRequest {
  items: OrderRequestItem[];
  customer: {
    name: string;
    phone: string;
    email: string | null;
    gstin: string | null;
  };
  pincode: string;
  idempotencyKey: string;
}

function fail(message: string, status = 400): never {
  throw new AppError("VALIDATION_ERROR", message, status);
}

export function parseOrderRequestBody(body: unknown): ParsedOrderRequest {
  if (typeof body !== "object" || body === null) {
    fail("Request body must be a JSON object.");
  }
  const record = body as Record<string, unknown>;

  const rawItems = record["items"];
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    fail("The order must contain at least one item.");
  }
  const items: OrderRequestItem[] = rawItems.map((raw) => {
    if (typeof raw !== "object" || raw === null) {
      fail("Each item needs a productId and a quantity.");
    }
    const row = raw as Record<string, unknown>;
    const productId = String(row["productId"] ?? "");
    const quantity = row["quantity"];
    if (!UUID_RE.test(productId)) {
      fail("One of the products is invalid.");
    }
    if (
      typeof quantity !== "number" ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > ORDER_MAX_QTY
    ) {
      fail(`Quantities must be whole numbers from 1 to ${ORDER_MAX_QTY}.`);
    }
    return { productId, quantity };
  });

  const rawCustomer = record["customer"];
  if (typeof rawCustomer !== "object" || rawCustomer === null) {
    fail("Customer details are required.");
  }
  const c = rawCustomer as Record<string, unknown>;
  const form: CheckoutFormData = {
    name: String(c["name"] ?? ""),
    phone: String(c["phone"] ?? ""),
    email: String(c["email"] ?? ""),
    gstin: String(c["gstin"] ?? ""),
    pincode: String(record["pincode"] ?? ""),
  };
  const validation = validateCheckoutForm(form, items.length);
  if (!validation.valid) {
    const first = (
      ["name", "phone", "email", "gstin", "pincode"] as const
    ).find((f) => validation.errors[f]);
    fail(
      (first && validation.errors[first]) ||
        "Customer details are incomplete.",
      422,
    );
  }
  const customer = normalizeCheckoutForm(form);

  const idempotencyKey = String(record["idempotencyKey"] ?? "");
  if (!UUID_RE.test(idempotencyKey)) {
    fail("A valid idempotency key is required.");
  }

  return { items, customer, pincode: customer.pincode, idempotencyKey };
}
