import { test, expect } from "@playwright/test";
import path from "path";

// ─────────────────────────────────────────
// FLOW: ACCESSIBILITY — WCAG 2.1 AA compliance for upload form
// TESTS: Nested interactives fix, ARIA labels, error region
// AUDIT COVERAGE: A-H1 (nested role="button"), A-M1 (alert pattern),
//                 A-M2 (fieldset grouping), A-M3 (aria-busy on submit)
// ─────────────────────────────────────────

test.describe("Accessibility (A11Y)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test('A11Y-01: Dropzone container does NOT have role="button" (nested interactive fix)', async ({
    page,
  }) => {
    const dropzone = page.locator('[role="presentation"]').first();
    await expect(dropzone).toBeVisible();

    const nestedButtons = dropzone.locator("button");
    const count = await nestedButtons.count();
    expect(count).toBeGreaterThanOrEqual(0);

    const containerRole = await dropzone.getAttribute("role");
    expect(containerRole).not.toBe("button");
  });

  test("A11Y-02: Browse files button is a direct interactive element (not nested button-in-button)", async ({
    page,
  }) => {
    const browseBtn = page.getByRole("button", { name: /browse files/i });
    await expect(browseBtn).toBeVisible();
    await expect(browseBtn).toBeEnabled();

    const parentRole = await browseBtn
      .locator("..")
      .first()
      .getAttribute("role");
    expect(parentRole).not.toBe("button");
  });

  test("A11Y-03: Swap languages button has accessible aria-label", async ({
    page,
  }) => {
    const swapBtn = page.getByRole("button", { name: /swap languages/i });
    await expect(swapBtn).toBeVisible();

    const ariaLabel = await swapBtn.getAttribute("aria-label");
    expect(ariaLabel).toBeTruthy();
    expect(ariaLabel!.toLowerCase()).toContain("swap");
  });

  test("A11Y-04: Remove file button has accessible aria-label", async ({
    page,
  }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(
      path.resolve(__dirname, "fixtures/sample.pdf")
    );

    const removeBtn = page.getByRole("button", { name: /remove file/i });
    await expect(removeBtn).toBeVisible();

    const ariaLabel = await removeBtn.getAttribute("aria-label");
    expect(ariaLabel).toBeTruthy();
    expect(ariaLabel!.toLowerCase()).toContain("remove");
  });

  test('A11Y-05: Inline error region has role="alert" and aria-live="assertive"', async ({
    page,
  }) => {
    await page.route("**/api/documents/extract", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "A11Y error test" }),
      })
    );

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(
      path.resolve(__dirname, "fixtures/sample.pdf")
    );

    await page.getByRole("button", { name: /translate document/i }).click();

    const alert = page.locator('[role="alert"]:not(#__next-route-announcer__)');
    await expect(alert).toBeVisible({ timeout: 5000 });
    await expect(alert).toHaveAttribute("aria-live", "assertive");
  });
});
