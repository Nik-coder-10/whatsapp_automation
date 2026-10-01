import { afterEach, describe, expect, it } from "vitest";
import { getWhatsAppLink, getWhatsAppNumber } from "@/lib/contact";

const KEY = "NEXT_PUBLIC_WHATSAPP_NUMBER";

afterEach(() => {
  delete process.env[KEY];
});

describe("public contact config (no hard-coded numbers)", () => {
  it("returns null when unconfigured", () => {
    expect(getWhatsAppNumber()).toBeNull();
    expect(getWhatsAppLink("hello")).toBeNull();
  });

  it("builds a wa.me link when configured", () => {
    process.env[KEY] = "919876543210";
    expect(getWhatsAppNumber()).toBe("919876543210");
    expect(getWhatsAppLink("hello trolift")).toBe(
      "https://wa.me/919876543210?text=hello%20trolift",
    );
  });
});
