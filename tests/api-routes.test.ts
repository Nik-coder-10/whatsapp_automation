import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMockClient,
  type MockResponder,
} from "@/tests/helpers/supabase-mock";
import { resetRateLimits } from "@/lib/rate-limit/index";

beforeEach(() => resetRateLimits());

vi.mock("server-only", () => ({}));

let serverHandler: MockResponder = () => {
  throw new Error("unexpected server query");
};
let adminHandler: MockResponder = () => {
  throw new Error("unexpected admin query");
};
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => createMockClient(serverHandler),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => createMockClient(adminHandler),
}));

import { POST as deliveryPost } from "@/app/api/delivery/check/route";
import { POST as claimPost } from "@/app/api/payments/claim/route";

const OID = "c0ffee00-0001-4000-8000-000000000001";

const call = (
  fn: (req: Request) => Promise<Response>,
  body: unknown,
) =>
  fn(
    new Request("http://localhost/x", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

const rateRow = (charge: string, priority = 100) => ({
  delivery_partner_id: "a1b2c3d4-0001-4000-8000-000000000001",
  serviceable: true,
  delivery_charge: charge,
  eta_min_days: 2,
  eta_max_days: 4,
  min_order_amount: null,
  max_order_amount: null,
  delivery_partners: { name: "Delhivery", is_active: true, priority },
});

describe("POST /api/delivery/check", () => {
  it("returns the selected partner and charge, options included", async () => {
    serverHandler = (op) => {
      if (op.table === "delivery_pincode_rates") {
        return { rows: [rateRow("450.00")], error: null };
      }
      throw new Error("unreachable");
    };
    const res = await call(deliveryPost, {
      pincode: "400001",
      subtotalPaise: 2544900,
    });
    const json = (await res.json()) as {
      ok: boolean;
      data: Record<string, unknown>;
    };
    expect(json.ok).toBe(true);
    expect(json.data).toMatchObject({
      serviceable: true,
      pincode: "400001",
      deliveryChargePaise: 45000,
    });
  });

  it("reports unknown pincodes as unserviceable, not errors", async () => {
    serverHandler = (op) => {
      if (op.table === "delivery_pincode_rates") {
        return { rows: [], error: null };
      }
      throw new Error("unreachable");
    };
    const res = await call(deliveryPost, { pincode: "799001" });
    const json = (await res.json()) as {
      ok: boolean;
      data: Record<string, unknown>;
    };
    expect(json.ok).toBe(true);
    expect(json.data.serviceable).toBe(false);
  });

  it("rejects malformed input", async () => {
    for (const body of [{ pincode: "12" }, { pincode: "" }, { pincode: "400001", subtotalPaise: -1 }]) {
      const res = await call(deliveryPost, body);
      expect(((await res.json()) as { ok: boolean }).ok).toBe(false);
    }
  });
});

const orderRow = {
  id: OID,
  order_number: "TS-261004-0001",
  customer_id: "cust-1",
  payment_status: "pending",
  order_status: "pending_payment",
};
const customerRow = { phone: "+919876543210" };
const paymentRow = { id: "pay-1", status: "pending" };

function wireClaim(over: {
  order?: unknown;
  customer?: unknown;
  payment?: unknown;
  updateError?: { message: string; code?: string } | null;
} = {}) {
  adminHandler = (op) => {
    if (op.table === "orders" && !op.updateValues) {
      return { rows: [over.order ?? orderRow], error: null };
    }
    if (op.table === "customers") {
      return { rows: [over.customer ?? customerRow], error: null };
    }
    if (op.table === "payments" && !op.updateValues) {
      return { rows: [over.payment ?? paymentRow], error: null };
    }
    if (op.updateValues) {
      if (over.updateError) return { rows: [], error: over.updateError };
      return { rows: [{ id: "x" }], error: null };
    }
    throw new Error(`unreachable ${op.table}`);
  };
}

describe("POST /api/payments/claim (reference only, never amounts)", () => {
  it("submits a valid claim with phone match", async () => {
    wireClaim();
    const res = await call(claimPost, {
      orderId: OID,
      reference: "123456789012",
      phone: "09876543210",
    });
    const json = (await res.json()) as {
      ok: boolean;
      data: Record<string, unknown>;
    };
    expect(json.ok).toBe(true);
    expect(json.data).toMatchObject({
      orderId: OID,
      paymentStatus: "submitted",
      orderStatus: "payment_submitted",
    });
  });

  it("rejects a mismatched phone (IDOR guard)", async () => {
    wireClaim();
    const res = await call(claimPost, {
      orderId: OID,
      reference: "123456789012",
      phone: "+911111111111",
    });
    const json = (await res.json()) as {
      ok: boolean;
      error: { code: string };
    };
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("FORBIDDEN");
  });

  it("rejects claims in non-payable states", async () => {
    wireClaim({
      order: { ...orderRow, payment_status: "paid", order_status: "confirmed" },
      payment: { id: "pay-1", status: "paid" },
    });
    const res = await call(claimPost, {
      orderId: OID,
      reference: "123456789012",
      phone: "+919876543210",
    });
    const json = (await res.json()) as {
      ok: boolean;
      error: { code: string };
    };
    expect(json.ok).toBe(false);
    expect(["BAD_REQUEST", "FORBIDDEN"]).toContain(json.error.code);
  });

  it("treats a duplicate UTR as a conflict, not a new record", async () => {
    wireClaim({
      updateError: { message: "duplicate key", code: "23505" },
    });
    const res = await call(claimPost, {
      orderId: OID,
      reference: "123456789012",
      phone: "+919876543210",
    });
    const json = (await res.json()) as {
      ok: boolean;
      error: { code: string };
    };
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("BAD_REQUEST");
  });

  it("rejects malformed bodies", async () => {
    for (const body of [
      { orderId: "nope", reference: "123456789012", phone: "+919876543210" },
      { orderId: OID, reference: "", phone: "+919876543210" },
      { orderId: OID, reference: "123456789012", phone: "" },
    ]) {
      const res = await call(claimPost, body);
      expect(((await res.json()) as { ok: boolean }).ok).toBe(false);
    }
  });
});
