import { beforeEach, describe, expect, it, vi } from "vitest";

// server-only modules throw outside the Next server runtime by design.
vi.mock("server-only", () => ({}));

import {
  createMockClient,
  type MockResponder,
} from "@/tests/helpers/supabase-mock";
import { resetRateLimits } from "@/lib/rate-limit/index";

let authUser: { id: string } | null = { id: "admin-1" };
let adminFlag = true;
let handler: MockResponder = () => {
  throw new Error("unexpected query");
};
vi.mock("@/lib/supabase/server", () => ({
  createClient: () =>
    createMockClient((op) => {
      if (op.table === "profiles") {
        return { rows: adminFlag ? [{ is_admin: true }] : [], error: null };
      }
      return handler(op);
    }, { authUser }),
}));

import { toJsonLdScript } from "@/lib/seo/jsonld";
import { escapeCsvExportCell } from "@/lib/admin/csv";
import { routeLimit } from "@/lib/rate-limit/index";
import { coerceProductInput } from "@/app/api/admin/products/route";
import { GET as exportGet } from "@/app/api/admin/export/[type]/route";

beforeEach(() => {
  resetRateLimits();
  authUser = { id: "admin-1" };
  adminFlag = true;
  handler = () => {
    throw new Error("unexpected query");
  };
  delete process.env.RATE_LIMIT_EXPORT_PER_MIN;
});

describe("stored XSS via JSON-LD (admin input, all-visitor output)", () => {
  it("neutralizes script breakouts while staying valid JSON", () => {
    const payload = {
      name: 'Trolley</script><script>alert("xss")</script>',
      description: "a < b",
    };
    const out = toJsonLdScript(payload);
    expect(out).not.toContain("</script>");
    expect(out).not.toContain("<script>");
    expect(out).toContain("\\u003c");
    // Still parses back to the exact original values.
    expect(JSON.parse(out)).toEqual(payload);
  });
});

describe("CSV formula injection (export downloads)", () => {
  it("prefixes executable leading characters, leaves the rest alone", () => {
    expect(escapeCsvExportCell("=cmd|'/C calc'!A0")).toBe("'=cmd|'/C calc'!A0");
    expect(escapeCsvExportCell("+919810001111")).toBe("'+919810001111");
    expect(escapeCsvExportCell("-2+3")).toBe("'-2+3");
    expect(escapeCsvExportCell("@mention")).toBe("'@mention");
    expect(escapeCsvExportCell("plain name")).toBe("plain name");
    expect(escapeCsvExportCell("6299.00")).toBe("6299.00");
    // Quoting still applies after the guard.
    expect(escapeCsvExportCell('=a,"b"')).toBe(`"'=a,""b"""`);
  });

  it("neutralizes hostile customer fields in a real export", async () => {
    let calls = 0;
    handler = (op) => {
      if (op.table === "customers" && !op.updateValues) {
        calls++;
        if (calls === 1) return { rows: [], error: null, count: 1 };
        if (calls === 2) {
          return {
            rows: [
              {
                name: "=HYPERLINK(\"http://evil\",\"x\")",
                phone: "+919810001111",
                email: null,
                gstin: null,
                billing_name: null,
                billing_address_line: null,
                billing_city: null,
                billing_state: null,
                billing_pincode: null,
                created_at: "2026-10-01T00:00:00Z",
              },
            ],
            error: null,
          };
        }
        return { rows: [], error: null };
      }
      if (op.table === "admin_audit_log") {
        return { rows: [{ id: "a1" }], error: null };
      }
      throw new Error(`unexpected ${op.table ?? op.rpc}`);
    };
    const res = await exportGet(new Request("http://localhost/x"), {
      params: Promise.resolve({ type: "customers" }),
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain(`"'=HYPERLINK(""http://evil"",""x"")"`);
    expect(text).toContain("'+919810001111");
  });
});

describe("mass assignment (explicit allowlists only)", () => {
  it("drops privileged and internal fields from product input", () => {
    const coerced = coerceProductInput({
      name: "Trolley",
      slug: "trolley",
      description: "d",
      priceRupees: "10.00",
      category: "Tools",
      images: [],
      specificationsJson: "{}",
      stockQuantity: 1,
      lowStockThreshold: 1,
      isActive: true,
      gstRate: "",
      weightKg: "",
      // Attacker-supplied extras:
      is_admin: true,
      id: "evil-id",
      created_at: "2020-01-01",
      price: "0.01",
      role: "admin",
    });
    expect(coerced).not.toHaveProperty("is_admin");
    expect(coerced).not.toHaveProperty("id");
    expect(coerced).not.toHaveProperty("created_at");
    expect(coerced).not.toHaveProperty("price");
    expect(coerced).not.toHaveProperty("role");
    expect(coerced.name).toBe("Trolley");
  });
});

describe("rate limits on expensive routes", () => {
  it("defines budgets for import, export and invoice routes", () => {
    expect(routeLimit("import").limit).toBeGreaterThan(0);
    expect(routeLimit("export").limit).toBeGreaterThan(0);
    expect(routeLimit("invoice").limit).toBeGreaterThan(0);
    process.env.RATE_LIMIT_EXPORT_PER_MIN = "3";
    expect(routeLimit("export").limit).toBe(3);
  });

  it("429s export floods instead of serving them", async () => {
    handler = (op) => {
      if (op.table === "products" && !op.updateValues) {
        return { rows: [], error: null, count: 0 };
      }
      if (op.table === "admin_audit_log") {
        return { rows: [{ id: "a1" }], error: null };
      }
      throw new Error(`unexpected ${op.table ?? op.rpc}`);
    };
    const get = () =>
      exportGet(new Request("http://localhost/x"), {
        params: Promise.resolve({ type: "products" }),
      });
    const codes: number[] = [];
    for (let i = 0; i < 11; i++) {
      codes.push((await get()).status);
    }
    expect(codes.slice(0, 10).every((s) => s === 200)).toBe(true);
    expect(codes[10]).toBe(429);
  });
});
