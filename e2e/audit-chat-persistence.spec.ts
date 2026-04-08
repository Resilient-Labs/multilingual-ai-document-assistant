import { test, expect, type Page } from "@playwright/test";
import { seedTranslateSession, TEST_DOC_ID } from "./helpers/session";

// ─────────────────────────────────────────
// FLOW: Chat History Persistence — IndexedDB survival across page reloads
// TESTS: messages persist, reload restores, scoping by docId, error isolation
// AUDIT COVERAGE: PRINCIPAL M2 (addMessage error handling), M4 (sequential persistence),
//   DEVOPS M4 (chatHistory.error), A11Y M1 (loading history state)
// ─────────────────────────────────────────

/**
 * Stub /api/ask to return a deterministic JSON response.
 * Accepts a static answer string or a function that inspects the question.
 * AskTab's dual JSON/stream parser extracts `parsed.answer` from the payload.
 */
async function stubAskApi(
  page: Page,
  answerOrFn: string | ((question: string) => string),
) {
  await page.route("**/api/ask", async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}") as {
      question?: string;
    };
    const answer =
      typeof answerOrFn === "function"
        ? answerOrFn(body.question ?? "")
        : answerOrFn;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ answer }),
    });
  });
}

/**
 * Submit a question via the UI and wait for the full cycle to complete:
 * response rendered → persisted to IndexedDB → pendingMessages cleared → input re-enabled.
 */
async function askAndWaitForPersistence(
  page: Page,
  question: string,
  expectedAnswer: string,
) {
  const input = page.getByLabel("Question input");
  await input.fill(question);
  await input.press("Enter");

  await expect(page.getByText(expectedAnswer)).toBeVisible({ timeout: 30_000 });
  await expect(input).toBeEnabled({ timeout: 15_000 });
}

test.describe("Chat History Persistence", () => {
  test.setTimeout(90_000);

  test("PERSIST-01: chat messages survive page refresh", async ({ page }) => {
    await stubAskApi(page, "The document covers immigration paperwork.");
    await seedTranslateSession(page);
    await page.goto(`/translate/${TEST_DOC_ID}`);
    await expect(page.getByText("Ask about this document")).toBeVisible();

    await askAndWaitForPersistence(
      page,
      "What is this about?",
      "The document covers immigration paperwork.",
    );

    // Reload — sessionStorage persists (same tab), IndexedDB persists
    await page.reload();
    await expect(page.getByText("Ask about this document")).toBeVisible();

    // Both messages should load from IndexedDB
    await expect(page.getByText("What is this about?")).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByText("The document covers immigration paperwork."),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("PERSIST-02: multiple exchanges persist in order after reload", async ({
    page,
  }) => {
    await stubAskApi(page, (q) =>
      q.includes("First") ? "Answer one." : "Answer two.",
    );
    await seedTranslateSession(page);
    await page.goto(`/translate/${TEST_DOC_ID}`);
    await expect(page.getByText("Ask about this document")).toBeVisible();

    await askAndWaitForPersistence(page, "First question", "Answer one.");
    await askAndWaitForPersistence(page, "Second question", "Answer two.");

    await page.reload();
    await expect(page.getByText("Ask about this document")).toBeVisible();

    // All four messages should be restored
    await expect(page.getByText("First question")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Answer one.")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Second question")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Answer two.")).toBeVisible({
      timeout: 15_000,
    });

    // Verify DOM ordering: each question precedes its answer
    const scrollArea = page.locator(".overflow-y-auto").first();
    const allText = (await scrollArea.textContent()) ?? "";

    const i1 = allText.indexOf("First question");
    const i2 = allText.indexOf("Answer one.");
    const i3 = allText.indexOf("Second question");
    const i4 = allText.indexOf("Answer two.");

    expect(i1).toBeGreaterThanOrEqual(0);
    expect(i1).toBeLessThan(i2);
    expect(i2).toBeLessThan(i3);
    expect(i3).toBeLessThan(i4);
  });

  test('PERSIST-03: "Loading history..." shows while fetching persisted data', async ({
    page,
  }) => {
    await stubAskApi(page, "Stored response.");
    await seedTranslateSession(page);
    await page.goto(`/translate/${TEST_DOC_ID}`);
    await expect(page.getByText("Ask about this document")).toBeVisible();

    // Persist a message so there is something to load on reload
    await askAndWaitForPersistence(page, "Store this", "Stored response.");

    await page.reload();

    // The loading indicator should appear while getChatHistory reads IndexedDB
    await expect(page.getByText("Loading history...")).toBeVisible({
      timeout: 5_000,
    });

    // Then it should resolve and the persisted message should render
    await expect(page.getByText("Loading history...")).toBeHidden({
      timeout: 15_000,
    });
    await expect(page.getByText("Stored response.")).toBeVisible();
  });

  test("PERSIST-04: messages are scoped per document ID", async ({ page }) => {
    await stubAskApi(page, "Answer for doc A.");
    await seedTranslateSession(page);
    await page.goto(`/translate/${TEST_DOC_ID}`);
    await expect(page.getByText("Ask about this document")).toBeVisible();

    await askAndWaitForPersistence(
      page,
      "Question for doc A",
      "Answer for doc A.",
    );

    // Navigate to a different document
    const otherDocId = "other-doc-456";
    await seedTranslateSession(page, otherDocId);
    await page.goto(`/translate/${otherDocId}`);
    await expect(page.getByText("Ask about this document")).toBeVisible();

    // Doc B should show the empty placeholder — no messages from doc A
    await expect(
      page.getByText("Ask a question about the document above."),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Question for doc A")).toBeHidden();
    await expect(page.getByText("Answer for doc A.")).toBeHidden();
  });

  test("PERSIST-05: fresh document with no history shows empty placeholder", async ({
    page,
  }) => {
    const freshDocId = `fresh-doc-${Date.now()}`;
    await seedTranslateSession(page, freshDocId);
    await page.goto(`/translate/${freshDocId}`);
    await expect(page.getByText("Ask about this document")).toBeVisible();

    // Should settle on the empty placeholder — no loading-forever, no crash
    await expect(
      page.getByText("Ask a question about the document above."),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("PERSIST-06: API error during ask flow does not persist broken messages", async ({
    page,
  }) => {
    await seedTranslateSession(page);
    await page.goto(`/translate/${TEST_DOC_ID}`);
    await expect(page.getByText("Ask about this document")).toBeVisible();

    // Force the API to fail
    await page.route("**/api/ask", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Simulated server failure" }),
      }),
    );

    const input = page.getByLabel("Question input");
    await input.fill("This should not persist");
    await input.press("Enter");

    // Error alert should appear
    await expect(page.getByText("Simulated server failure")).toBeVisible({
      timeout: 10_000,
    });

    // Input should re-enable after error
    await expect(input).toBeEnabled({ timeout: 5_000 });

    // Reload — if any messages leaked into IndexedDB, they would reappear
    await page.reload();
    await expect(page.getByText("Ask about this document")).toBeVisible();

    // Wait for history load to finish — should show empty placeholder
    await expect(
      page.getByText("Ask a question about the document above."),
    ).toBeVisible({ timeout: 10_000 });

    // The failed question must NOT appear in persisted history
    await expect(page.getByText("This should not persist")).toBeHidden();
  });
});
