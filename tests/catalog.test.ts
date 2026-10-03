import { describe, expect, it } from "vitest";
import {
  ALL_PRODUCTS,
  FEATURED_PRODUCTS,
  groupByCategory,
  parseCatalogueParams,
  slugifyCategory,
} from "@/lib/catalog/products";
import {
  getCataloguePage,
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

describe("parseCatalogueParams", () => {
  it("defaults page 1 and standard page size", () => {
    expect(parseCatalogueParams({})).toEqual({ page: 1, pageSize: 12 });
  });

  it("clamps page and page size", () => {
    expect(parseCatalogueParams({ page: "0", pageSize: "999" })).toEqual({
      page: 1,
      pageSize: 48,
    });
    expect(parseCatalogueParams({ page: "abc", pageSize: "-3" })).toEqual({
      page: 1,
      pageSize: 1,
    });
  });

  it("trims category and takes the first of repeated params", () => {
    expect(
      parseCatalogueParams({ category: " trolleys ", page: ["2", "3"] }),
    ).toEqual({ categorySlug: "trolleys", page: 2, pageSize: 12 });
  });

  it("drops blank category", () => {
    expect(parseCatalogueParams({ category: "  " }).categorySlug).toBeUndefined();
  });
});

describe("getCataloguePage without Supabase (offline fallback)", () => {
  it("pages all products", async () => {
    const r = await getCataloguePage({ page: 1, pageSize: 12 });
    expect(r.total).toBe(8);
    expect(r.totalPages).toBe(1);
    expect(r.products).toHaveLength(8);
    expect(r.unknownCategory).toBe(false);
    expect(r.live).toBe(false);
  });

  it("slices pages", async () => {
    const r = await getCataloguePage({ page: 3, pageSize: 3 });
    expect(r.total).toBe(8);
    expect(r.totalPages).toBe(3);
    expect(r.products).toHaveLength(2);
  });

  it("filters by category slug", async () => {
    const r = await getCataloguePage({
      categorySlug: "trolleys",
      page: 1,
      pageSize: 12,
    });
    expect(r.total).toBe(1);
    expect(r.activeCategory?.name).toBe("Trolleys");
    expect(r.unknownCategory).toBe(false);
  });

  it("reports unknown categories as empty, not errors", async () => {
    const r = await getCataloguePage({
      categorySlug: "nope",
      page: 1,
      pageSize: 12,
    });
    expect(r.unknownCategory).toBe(true);
    expect(r.products).toHaveLength(0);
    expect(r.total).toBe(0);
  });

  it("returns an empty page past the end", async () => {
    const r = await getCataloguePage({ page: 99, pageSize: 12 });
    expect(r.products).toHaveLength(0);
    expect(r.total).toBe(8);
    expect(r.totalPages).toBe(1);
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
