import { expect, test } from "@playwright/test";

/**
 * Security posture at the browser boundary: unauthenticated visitors
 * cannot see admin UI, guest order URLs fail closed, and protected
 * APIs reject anonymous callers. Deeper authorization is proven in
 * tests/security.test.ts and the HTTP journey in tests/journey.test.ts.
 */
test.describe("admin and access control", () => {
  test("/admin never renders admin UI to anonymous visitors", async ({
    page,
  }) => {
    await page.goto("/admin");
    // With a backend: proxy redirects to /admin/login. Without one
    // (this harness), the protected layout renders an inline gate.
    // Either way, no admin content may appear.
    await expect(
      page
        .getByRole("heading", { name: /sign in(required)?/i })
        .first(),
    ).toBeVisible();
    await expect(page.getByText(/dashboard/i)).toHaveCount(0);
  });

  test("login page renders email/password form", async ({ page }) => {
    await page.goto("/admin/login");
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /sign in/i }),
    ).toBeVisible();
  });

  test("unknown order UUID renders not-found, not data", async ({ page }) => {
    await page.goto("/orders/123e4567-e89b-12d3-a456-426614174000");
    // Fail closed and observable: the not-found UI appears and no
    // order details leak (no order number, totals, or timeline).
    await expect(
      page.getByRole("heading", { name: /page not found/i }),
    ).toBeVisible();
    await expect(page.getByText(/TS-\d/i)).toHaveCount(0);
  });

  test("malformed order id does not crash or leak", async ({ page }) => {
    await page.goto("/orders/not-a-uuid");
    await expect(
      page.getByRole("heading", { name: /page not found/i }),
    ).toBeVisible();
  });

  test("admin APIs reject anonymous callers", async ({ request }) => {
    for (const url of [
      "/api/admin/products",
      "/api/admin/orders",
      "/api/admin/customers",
      "/api/admin/export/products",
    ]) {
      const res = await request.get(url);
      expect(res.status(), url).toBe(401);
    }
  });

  test("public APIs stay reachable without a session", async ({
    request,
  }) => {
    const health = await request.get("/api/health");
    expect(health.status()).toBe(200);
  });
});
