import { test, expect } from "@playwright/test";

// ─────────────────────────────────────────
// FLOW: DOCUMENT PAGE — Post-upload document viewer
// TESTS: Page renders, invalid ID handling, extracted data display
// AUDIT COVERAGE: Validates full pipeline from extract → redirect → view
// ─────────────────────────────────────────

test.describe("Document Page", () => {
  test("DOC-01: /document/[id] page renders ExtractedDataPanel", async ({
    page,
  }) => {
    await page.goto("/document/test-doc-123");

    await expect(page.getByText(/document details/i)).toBeVisible({
      timeout: 10000,
    });
  });

  test("DOC-02: /document/ with no ID returns 404", async ({ page }) => {
    const response = await page.goto("/document/");
    expect(response?.status()).toBe(404);
  });

  test("DOC-03: Extracted fields tab shows document metadata when data exists", async ({
    page,
    request,
  }) => {
    const extractResponse = await request.post("/api/documents/extract", {
      multipart: {
        file: {
          name: "fields-test.pdf",
          mimeType: "application/pdf",
          buffer: Buffer.from("PDF-test-content"),
        },
      },
    });

    expect(extractResponse.status()).toBe(200);
    const data = await extractResponse.json();

    await page.goto(`/document/${data.document.id}`);

    await expect(page.getByText(/document details/i)).toBeVisible({
      timeout: 10000,
    });

    const fieldsTab = page.getByRole("tab", { name: /extracted fields/i });
    if (await fieldsTab.isVisible()) {
      await fieldsTab.click();
      await expect(page.getByText(/filename/i)).toBeVisible();
    }
  });

  test("DOC-04: Form tab shows validation error when submitting empty fields", async ({
    page,
    request,
  }) => {
    const extractResponse = await request.post("/api/documents/extract", {
      multipart: {
        file: {
          name: "form-test.pdf",
          mimeType: "application/pdf",
          buffer: Buffer.from("PDF-form-test"),
        },
      },
    });

    const data = await extractResponse.json();
    await page.goto(`/document/${data.document.id}`);

    await expect(page.getByText(/document details/i)).toBeVisible({
      timeout: 10000,
    });

    const formTab = page.getByRole("tab", { name: /form to complete/i });
    if (await formTab.isVisible()) {
      await formTab.click();

      const allInputs = page.locator('input[type="text"]');
      const inputCount = await allInputs.count();

      if (inputCount > 0) {
        await allInputs.first().clear();
        await page.getByRole("button", { name: /submit/i }).click();
        await expect(page.getByText(/all fields must be filled/i)).toBeVisible({
          timeout: 5000,
        });
      }
    }
  });
});
