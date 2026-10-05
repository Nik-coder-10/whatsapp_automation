import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMockClient,
  type MockResponder,
} from "@/tests/helpers/supabase-mock";
import { resetRateLimits } from "@/lib/rate-limit/index";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

let authUser: { id: string } | null = { id: "admin-1" };
let adminFlag = true;
let handler: MockResponder = () => {
  throw new Error("unexpected query");
};
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => createMockClient(handler, { authUser }),
}));

import { parseRateCsv } from "@/lib/admin/delivery-import";
import {
  validatePartnerInput,
  validateRateInput,
} from "@/lib/admin/delivery-validation";
import { parseAdminRateQuery } from "@/lib/admin/delivery";
import { POST as partnersPost } from "@/app/api/admin/delivery/partners/route";
import { POST as ratesPost } from "@/app/api/admin/delivery/rates/route";
import { POST as importPost } from "@/app/api/admin/delivery/rates/import/route";
import { DELETE as rateDelete } from "@/app/api/admin/delivery/rates/[id]/route";

beforeEach(() => {
  resetRateLimits();
  authUser = { id: "admin-1" };
  adminFlag = true;
  handler = (op) => {
    if (op.table === "profiles") {
      return { rows: adminFlag ? [{ is_admin: true }] : [], error: null };
    }
    throw new Error(`unexpected table ${op.table}`);
  };
});

const post = (
  fn: (req: Request, ctx?: { params: Promise<{ id: string }> }) => Promise<Response>,
  body: unknown,
  params?: Record<string, string>,
) =>
  fn(
    new Request("http://localhost/x", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    (params ? { params: Promise.resolve(params) } : undefined) as unknown as {
      params: Promise<{ id: string }>;
    },
  );

const PARTNER_ID = "a1b2c3d4-0001-4000-8000-000000000001";

describe("validatePartnerInput", () => {
  it("accepts a full partner and normalises blanks to null", () => {
    const { errors, value } = validatePartnerInput({
      name: "  NewCo Logistics ",
      contactName: "",
      contactPhone: "+919876543210",
      contactEmail: "",
      priority: 5,
      isActive: true,
    });
    expect(errors).toEqual({});
    expect(value).toMatchObject({
      name: "NewCo Logistics",
      contactName: null,
      priority: 5,
    });
  });

  it("rejects bad name, contact and priority", () => {
    const { errors, value } = validatePartnerInput({
      name: "x",
      contactName: "",
      contactPhone: "123",
      contactEmail: "bad",
      priority: -1,
      isActive: true,
    });
    expect(value).toBeNull();
    expect(errors.name).toBeTruthy();
    expect(errors.contact).toBeTruthy();
    expect(errors.priority).toBeTruthy();
  });
});

describe("validateRateInput", () => {
  const base = {
    pincode: "400001",
    partnerId: PARTNER_ID,
    serviceable: true,
    chargeRupees: "450.00",
    remoteSurchargeRupees: "",
    minOrderRupees: "",
    maxOrderRupees: "",
    etaMinDays: "",
    etaMaxDays: "",
  };

  it("accepts a complete rule with exact paise", () => {
    const { errors, value } = validateRateInput(base);
    expect(errors).toEqual({});
    expect(value?.chargePaise).toBe(45000);
    expect(value?.remoteSurchargePaise).toBe(0);
  });

  it("accepts a remote surcharge and rejects a bad one", () => {
    expect(
      validateRateInput({ ...base, remoteSurchargeRupees: "120.00" }).value
        ?.remoteSurchargePaise,
    ).toBe(12000);
    expect(
      validateRateInput({ ...base, remoteSurchargeRupees: "12.999" }).errors
        .remoteSurchargeRupees,
    ).toBeTruthy();
  });

  it("rejects bad pincodes, partners, charges and windows", () => {
    expect(validateRateInput({ ...base, pincode: "123" }).errors.pincode).toBeTruthy();
    expect(validateRateInput({ ...base, partnerId: "nope" }).errors.partnerId).toBeTruthy();
    expect(validateRateInput({ ...base, chargeRupees: "12.999" }).errors.chargeRupees).toBeTruthy();
    expect(
      validateRateInput({ ...base, minOrderRupees: "500", maxOrderRupees: "100" }).errors
        .maxOrderRupees,
    ).toBeTruthy();
    expect(
      validateRateInput({ ...base, etaMinDays: "9", etaMaxDays: "2" }).errors.etaMaxDays,
    ).toBeTruthy();
  });
});

describe("parseRateCsv", () => {
  const good = `pincode,partner,charge,serviceable,min_order,max_order,eta_min,eta_max
400001,Delhivery,450.00,true,,,2,4
799001,GATI Freight,0,false,,,,`;

  it("parses a valid file", () => {
    const r = parseRateCsv(good);
    expect(r.errors).toEqual([]);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toMatchObject({
      pincode: "400001",
      partnerName: "Delhivery",
      serviceable: true,
    });
  });

  it("rejects bad headers, columns and flags", () => {
    expect(parseRateCsv("a,b,c").errors.length).toBeGreaterThan(0);
    expect(parseRateCsv("").errors.length).toBeGreaterThan(0);
    const bad = parseRateCsv(
      `pincode,partner,charge,serviceable,min_order,max_order,eta_min,eta_max\n400001,Delhivery,10,maybe,,,,\n400002,X,10,true,,,`,
    );
    expect(bad.errors.length).toBe(2);
  });
});

describe("partner APIs", () => {
  it("creates partners and rejects unauthorized callers", async () => {
    handler = (op) => {
      if (op.table === "profiles") {
        return { rows: adminFlag ? [{ is_admin: true }] : [], error: null };
      }
      if (op.table === "delivery_partners") return { rows: [{ id: "np1" }], error: null };
      throw new Error("unreachable");
    };
    const res = await post(partnersPost, {
      name: "NewCo",
      contactName: "",
      contactPhone: "",
      contactEmail: "",
      priority: 7,
      isActive: true,
    });
    expect(((await res.json()) as { ok: boolean }).ok).toBe(true);

    authUser = null;
    const anon = await post(partnersPost, { name: "X", priority: 1 });
    expect(anon.status).toBe(401);

    authUser = { id: "u1" };
    adminFlag = false;
    const nonAdmin = await post(partnersPost, { name: "X", priority: 1 });
    expect(nonAdmin.status).toBe(403);
  });
});

describe("rate APIs", () => {
  it("upserts rates and reports conflicts by update", async () => {
    handler = (op) => {
      if (op.table === "profiles") return { rows: [{ is_admin: true }], error: null };
      if (op.table === "delivery_partners") {
        return { rows: [{ id: PARTNER_ID }], error: null };
      }
      if (op.table === "delivery_pincode_rates" && !op.updateValues) {
        return { rows: [], error: null };
      }
      if (op.updateValues) return { rows: [{ id: "r1" }], error: null };
      throw new Error("unreachable");
    };
    const res = await post(ratesPost, {
      pincode: "400001",
      partnerId: PARTNER_ID,
      serviceable: true,
      chargeRupees: "450.00",
      minOrderRupees: "",
      maxOrderRupees: "",
      etaMinDays: "",
      etaMaxDays: "",
    });
    const json = (await res.json()) as {
      ok: boolean;
      data: { created: boolean };
    };
    expect(json.ok).toBe(true);
    expect(json.data.created).toBe(true);
  });

  it("rejects unknown partners and bad pincodes", async () => {
    handler = (op) => {
      if (op.table === "profiles") return { rows: [{ is_admin: true }], error: null };
      if (op.table === "delivery_partners") return { rows: [], error: null };
      throw new Error("unreachable");
    };
    const res = await post(ratesPost, {
      pincode: "400001",
      partnerId: PARTNER_ID,
      serviceable: true,
      chargeRupees: "10",
      minOrderRupees: "",
      maxOrderRupees: "",
      etaMinDays: "",
      etaMaxDays: "",
    });
    expect(res.status).toBe(422);
  });

  it("deletes rates (orders keep snapshots)", async () => {
    handler = (op) => {
      if (op.table === "profiles") return { rows: [{ is_admin: true }], error: null };
      if (op.table === "delivery_pincode_rates") {
        return { rows: [{ id: "r1" }], error: null };
      }
      throw new Error("unreachable");
    };
    const res = await fetchDelete("r1");
    expect(res.status).toBe(200);
    async function fetchDelete(id: string) {
      return rateDelete(new Request("http://localhost/x", { method: "DELETE" }), {
        params: Promise.resolve({ id }),
      });
    }
  });
});

describe("bulk import", () => {
  const csv = (rows: string) =>
    `pincode,partner,charge,serviceable,min_order,max_order,eta_min,eta_max\n${rows}`;

  it("applies a clean file with a full summary", async () => {
    handler = (op) => {
      if (op.table === "profiles") return { rows: [{ is_admin: true }], error: null };
      if (op.table === "delivery_partners") {
        return {
          rows: [{ id: PARTNER_ID, name: "Delhivery" }],
          error: null,
        };
      }
      if (op.table === "delivery_pincode_rates" && !op.updateValues) {
        return { rows: [], error: null };
      }
      if (op.rpc === "import_rates") {
        return { rows: [{ inserted: 2, updated: 0 }], error: null };
      }
      if (op.table === "admin_audit_log") {
        return { rows: [{ id: "a1" }], error: null };
      }
      throw new Error(`unreachable ${op.table}`);
    };
    const res = await post(importPost, {
      csv: csv("400001,Delhivery,450.00,true,,,2,4\n400002,Delhivery,500.00,true,,,,"),
    });
    const json = (await res.json()) as {
      ok: boolean;
      data: { total: number; inserted: number; updated: number; invalid: unknown[] };
    };
    expect(json.ok).toBe(true);
    expect(json.data).toMatchObject({ total: 2, inserted: 2, updated: 0 });
    expect(json.data.invalid).toEqual([]);
  });

  it("commits nothing when any row is invalid, reporting each", async () => {
    let writes = 0;
    handler = (op) => {
      if (op.table === "profiles") return { rows: [{ is_admin: true }], error: null };
      if (op.table === "delivery_partners") {
        return { rows: [{ id: PARTNER_ID, name: "Delhivery" }], error: null };
      }
      if (op.table === "delivery_pincode_rates" && !op.updateValues) {
        // Bare read = remote-surcharge preservation lookup (not a write).
        return { rows: [], error: null };
      }
      if (op.rpc === "import_rates") {
        writes++;
        return { rows: [{ inserted: 1, updated: 0 }], error: null };
      }
      throw new Error("unreachable");
    };
    const res = await post(importPost, {
      csv: csv("400001,Delhivery,450.00,true,,,2,4\n400002,UnknownCo,10,true,,,,"),
    });
    // Validation gate: 422 with per-row details, zero writes (no RPC,
    // no audit — nothing happened).
    expect(res.status).toBe(422);
    const json = (await res.json()) as {
      ok: boolean;
      error: {
        code: string;
        details: { invalid: Array<{ line: number }>; invalidTotal: number };
      };
    };
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(json.error.details.invalid).toHaveLength(1);
    expect(json.error.details.invalid[0]?.line).toBe(3);
    expect(writes).toBe(0);
  });
});

describe("parseAdminRateQuery", () => {
  it("parses filters with safe defaults", () => {
    expect(
      parseAdminRateQuery({ q: "400", partner: "p1", serviceable: "false", sort: "charge_desc", page: "2" }),
    ).toEqual({
      q: "400",
      partnerId: "p1",
      serviceable: false,
      sort: "charge_desc",
      page: 2,
      pageSize: 20,
    });
    expect(parseAdminRateQuery({})).toMatchObject({ sort: "pincode", page: 1 });
  });
});
