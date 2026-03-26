import { test, expect } from "@playwright/test";
import path from "path";

// ─────────────────────────────────────────
// FLOW: UPLOAD — Core upload pipeline
// TESTS: Home page load, file selection, removal, submit gating, end-to-end
// AUDIT COVERAGE: H1 (contract alignment), M1 (component responsibilities)
// ─────────────────────────────────────────

test.describe("Upload Pipeline", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("UPLOAD-01: Home page loads with dropzone and translation controls", async ({
    page,
  }) => {
    await expect(
      page.getByRole("heading", { name: /upload a document/i })
    ).toBeVisible();

    await expect(page.getByText(/drag & drop or choose a file/i)).toBeVisible();

    await expect(
      page.getByRole("button", { name: /browse files/i })
    ).toBeVisible();

    await expect(page.getByText(/translation direction/i)).toBeVisible();
  });

  test("UPLOAD-02: User can select a file via Browse and see it displayed", async ({
    page,
  }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(
      path.resolve(__dirname, "fixtures/sample.pdf")
    );

    await expect(page.getByText("sample.pdf")).toBeVisible();
    await expect(page.getByText(/KB/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /remove file/i })
    ).toBeVisible();
  });

  test("UPLOAD-03: User can remove a selected file", async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(
      path.resolve(__dirname, "fixtures/sample.pdf")
    );

    await expect(page.getByText("sample.pdf")).toBeVisible();

    await page.getByRole("button", { name: /remove file/i }).click();

    await expect(page.getByText("sample.pdf")).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: /browse files/i })
    ).toBeVisible();
  });

  test("UPLOAD-04: Submit button is disabled when no file is selected", async ({
    page,
  }) => {
    const submitBtn = page.getByRole("button", {
      name: /translate document/i,
    });
    await expect(submitBtn).toBeDisabled();
  });

  test("UPLOAD-05: Submitting a valid file calls extract API and redirects", async ({
    page,
  }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(
      path.resolve(__dirname, "fixtures/sample.pdf")
    );

    const responsePromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/documents/extract") && res.status() === 200
    );

    await page.getByRole("button", { name: /translate document/i }).click();

    const response = await responsePromise;
    const body = await response.json();

    expect(body.document).toBeDefined();
    expect(body.document.id).toBeTruthy();
    expect(body.ocr).toBeDefined();

    await page.waitForURL(/\/document\/.+/);
    expect(page.url()).toMatch(/\/document\/.+/);
  });
});
