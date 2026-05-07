import { test, expect } from "@playwright/test";

// ─────────────────────────────────────────────────────────────────────────────
// SMOKE TESTS — Homepage
//
// These are intentionally minimal and self-contained: no session helpers,
// no API stubs, no localStorage seeding. They verify that:
//   1. The Next.js app boots and serves the root route
//   2. Core branding and the primary upload CTA are visible
//   3. The page <title> is populated (not blank)
//
// Run in isolation: npx playwright test smoke
// Debug interactively: npx playwright test smoke --debug
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Homepage smoke", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate once per test; each test gets a fresh page context
    await page.goto("/");
  });

  test("SMOKE-01: page loads and branding heading is visible", async ({
    page,
  }) => {
    // The desktop left-panel heading is the primary brand statement.
    // Confirms routing works and React hydration completed without errors.
    await expect(
      page.getByRole("heading", { name: /breaking language barriers/i }),
    ).toBeVisible();
  });

  test("SMOKE-02: upload section heading is present", async ({ page }) => {
    // The right-panel "Upload a document" heading anchors the main CTA.
    // If this is missing the form is unreachable and the core flow is broken.
    await expect(
      page.getByRole("heading", { name: /upload a document/i }),
    ).toBeVisible();
  });

  test("SMOKE-03: page <title> is not blank", async ({ page }) => {
    // A blank or missing title is a red flag for a broken layout or SSR error.
    await expect(page).toHaveTitle(/.+/);
  });
});
