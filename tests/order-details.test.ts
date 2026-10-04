import { describe, expect, it, vi } from "vitest";

// See tests/payments.test.ts: bypass the server-only guard in tests.
vi.mock("server-only", () => ({}));
import { buildTimeline, maskPhone } from "@/lib/orders/display";
import { getPayableOrder } from "@/lib/payments/order";

describe("buildTimeline (mirrors DB order_status)", () => {
  it("starts new orders at payment with placed done", () => {
    for (const s of ["draft", "pending_payment", "payment_submitted"] as const) {
      const { stages, cancelled } = buildTimeline(s);
      expect(cancelled).toBe(false);
      expect(stages[0]?.state).toBe("done");
      expect(stages[1]?.state).toBe("current");
      expect(stages.slice(2).every((x) => x.state === "todo")).toBe(true);
    }
  });

  it("advances one stage at a time without skipping", () => {
    const at = (s: Parameters<typeof buildTimeline>[0]) =>
      buildTimeline(s).stages.map((x) => x.state);
    expect(at("confirmed")).toEqual(["done", "done", "current", "todo", "todo", "todo"]);
    expect(at("processing")).toEqual(["done", "done", "done", "current", "todo", "todo"]);
    expect(at("shipped")).toEqual(["done", "done", "done", "current", "todo", "todo"]);
    expect(at("dispatched")).toEqual(["done", "done", "done", "done", "current", "todo"]);
    expect(at("delivered")).toEqual(["done", "done", "done", "done", "done", "done"]);
  });

  it("marks cancelled orders without completing the future", () => {
    const { stages, cancelled } = buildTimeline("cancelled");
    expect(cancelled).toBe(true);
    expect(stages.filter((x) => x.state === "done")).toHaveLength(1);
    expect(stages.some((x) => x.state === "current")).toBe(false);
  });
});

describe("maskPhone", () => {
  it("hides all but the last 4 digits", () => {
    expect(maskPhone("+919876543210")).toBe("••••••3210");
    expect(maskPhone(null)).toBe("—");
    expect(maskPhone("123")).toBe("••••");
  });
});

describe("order access without a backend (fail-closed)", () => {
  it("returns null for malformed ids without touching the DB", async () => {
    await expect(getPayableOrder("not-a-uuid")).resolves.toBeNull();
    await expect(getPayableOrder("")).resolves.toBeNull();
  });
});
