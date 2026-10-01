import { describe, expect, it } from "vitest";
import {
  ALL_PRODUCTS,
  FEATURED_PRODUCTS,
  groupByCategory,
  slugifyCategory,
} from "@/lib/catalog/products";
import {
  getCategories,
  getFeaturedProducts,
  getProductBySlug,
  getProductSlugs,
} from "@/lib/catalog/queries";

describe("groupByCategory", () => {
  it("counts, slugifies and sorts", () => {
    const out = groupByCategory([
      { category: "Trolleys" },
      { category: "Lifting & Stacking" },
      { category: "Trolleys" },
    ]);
    expect(out).toEqual([
      {
        slug: "lifting-and-stacking",
        name: "Lifting & Stacking",
        blurb: expect.any(String),
        productCount: 1,
      },
      {
        slug: "trolleys",
        name: "Trolleys",
        blurb: expect.any(String),
        productCount: 2,
      },
    ]);
  });

  it("falls back to a generic blurb for unknown categories", () => {
    const [only] = groupByCategory([{ category: "Ladders" }]);
    expect(only?.slug).toBe("ladders");
    expect(only?.blurb).toContain("ladders");
  });

  it("slugifies safely", () => {
    expect(slugifyCategory("Material Handling (Heavy)")).toBe(
      "material-handling-heavy",
    );
  });
});

describe("static fallback catalogue (mirrors seed.sql)", () => {
  it("covers every seed category", () => {
    const cats = new Set(ALL_PRODUCTS.map((p) => p.category));
    expect(cats.size).toBeGreaterThanOrEqual(6);
  });

  it("featured is a subset of all", () => {
    const ids = new Set(ALL_PRODUCTS.map((p) => p.id));
    for (const p of FEATURED_PRODUCTS) expect(ids.has(p.id)).toBe(true);
  });
});

describe("queries without Supabase configured (offline fallback)", () => {
  it("returns static featured products", async () => {
    const products = await getFeaturedProducts();
    expect(products.length).toBeGreaterThan(0);
    expect(products.every((p) => p.is_active)).toBe(true);
  });

  it("returns static categories with counts", async () => {
    const cats = await getCategories();
    expect(cats.length).toBeGreaterThan(0);
    expect(cats.every((c) => c.productCount > 0)).toBe(true);
  });

  it("lists static slugs for prerendering", async () => {
    const slugs = await getProductSlugs();
    expect(slugs).toContain("hydraulic-hand-pallet-truck-2500kg");
    expect(slugs.length).toBe(ALL_PRODUCTS.length);
  });

  it("finds a known slug, misses unknown ones", async () => {
    const found = await getProductBySlug(
      "hydraulic-hand-pallet-truck-2500kg",
    );
    expect(found?.name).toContain("Pallet Truck");
    expect(await getProductBySlug("no-such-product")).toBeNull();
  });
});
