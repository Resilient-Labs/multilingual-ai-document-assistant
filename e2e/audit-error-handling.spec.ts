import { test, expect } from "@playwright/test";
import path from "path";

// ─────────────────────────────────────────
// FLOW: ERROR HANDLING — Toast + inline error display
// TESTS: toast.error replaces alert(), inline role="alert", error clears on retry
// AUDIT COVERAGE: M5 (alert→toast), A-M1 (in-page error pattern WCAG 3.3.1)
// ─────────────────────────────────────────

test.describe("Error Handling", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("ERR-01: API error shows toast notification, not a browser alert", async ({
    page,
  }) => {
    await page.route("**/api/documents/extract", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Server exploded" }),
      })
    );

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(
      path.resolve(__dirname, "fixtures/sample.pdf")
    );

    let alertFired = false;
    page.on("dialog", () => {
      alertFired = true;
    });

    await page.getByRole("button", { name: /translate document/i }).click();

    await page.waitForTimeout(1000);

    expect(alertFired).toBe(false);

    const toastOrError = page
      .locator("[data-sonner-toast]")
      .or(page.locator('[role="alert"]'));
    await expect(toastOrError.first()).toBeVisible({ timeout: 5000 });
  });

  test("ERR-02: API error shows inline error message with role='alert'", async ({
    page,
  }) => {
    await page.route("**/api/documents/extract", (route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "Bad request test" }),
      })
    );

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(
      path.resolve(__dirname, "fixtures/sample.pdf")
    );

    await page.getByRole("button", { name: /translate document/i }).click();

    const inlineError = page.locator('[role="alert"]:not(#__next-route-announcer__)');
    await expect(inlineError).toBeVisible({ timeout: 5000 });
    await expect(inlineError).toHaveAttribute("aria-live", "assertive");
    await expect(inlineError).toContainText("Bad request test");
  });

  test("ERR-03: Error clears when user re-submits", async ({ page }) => {
    let callCount = 0;

    await page.route("**/api/documents/extract", (route) => {
      callCount++;
      if (callCount === 1) {
        return route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "First attempt fails" }),
        });
      }
      return route.continue();
    });

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(
      path.resolve(__dirname, "fixtures/sample.pdf")
    );

    await page.getByRole("button", { name: /translate document/i }).click();
    await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: /translate document/i }).click();

    await page.waitForURL(/\/document\/.+/, { timeout: 10000 });
    await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).not.toBeVisible();
  });
});
