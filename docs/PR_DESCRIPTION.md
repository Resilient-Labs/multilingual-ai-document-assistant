## Feature Summary

**What does this PR change?**  
- **Detect:** `DetectTab` no longer uses mock OCR text. It loads the current document from browser `sessionStorage` (`translate-${docId}`), using a `current-doc-id` pointer set at upload time (with a fallback to the most recent `translate-*` entry), and passes real `OCRResult` text into `useSafetyAnalysis` → `POST /api/safety`.  
- **Upload:** After a successful OCR/upload, the flow stores `current-doc-id` alongside the existing `translate-${docId}` session payload so the dashboard Detect tab can resolve the latest document without new backend storage.  
- **Safety API:** Hardens `POST /api/safety` for real OpenRouter responses: checks upstream HTTP status and returns `UPSTREAM_ERROR` (502) with `detail` when the provider fails; normalizes assistant text from `content` (string or parts, including `output_text`), `reasoning`, and `refusal`; extracts JSON from markdown fences or surrounding prose; scans all `choices`; uses a stable `path.join` path for `system-prompt.md`; removes the experimental `reasoning` request field that could yield empty `content`.  
- **Next steps:** Adjustments in `lib/safetyNextSteps.ts` aligned with curated next-step behavior (per recent commits on this branch).  
- **Repo:** Standard GitHub PR template content in `.github/pull_request_template.md`.

**Why was this change made?**  
- Users need **real** safety analysis on **uploaded** document text (zero-retention, client-held session data), not placeholder copy.  
- Production errors such as generic `INTERNAL_ERROR`, “no usable content,” and opaque OpenRouter failures needed **clearer server behavior** and **more robust parsing** so quota/auth/rate limits and odd model output shapes are handled predictably.

**What is the code meant to do?**  
After upload, opening **Detect** runs safety analysis on the same extracted text stored for translation, and shows **risk category**, **explanation**, **severity**, **confidence**, **next steps** (`presentation.primaryActions`), and **resources** (`presentation.resources`). The safety route remains **stateless** (no server-side persistence of document content).

---

## Feature Team / Lane

**Team #:** 5  
**DevOps Lane:** (if applicable) — *n/a*

---

## Type of Change

- [x] Feature
- [x] Bug fix
- [ ] Refactor
- [ ] Documentation
- [ ] CI/CD
- [ ] Other (please specify)

---

## Testing

**How was this tested?**

### Automated Testing

- [x] Unit tests added or updated (`app/api/safety/route.test.ts` — upstream error, markdown JSON, content arrays, `reasoning` fallback, etc.)
- [ ] Integration tests added or updated
- [x] Existing tests pass locally (`npx vitest run app/api/safety/route.test.ts`)
- [ ] CI pipeline passes

### Manual Testing

- [ ] Local testing completed
- [ ] API endpoints tested (`POST /api/safety` with real `OPEN_ROUTER_API_TOKEN`)
- [ ] UI manually tested (upload → open Detect / dashboard; confirm analysis matches uploaded text)
- [x] Edge cases considered (empty session, missing text, OpenRouter non-2xx, non-JSON / fenced JSON model output)

---

## Screenshots (if UI changes)

*Add screenshots of Detect tab showing risk flags, confidence, next steps, and resources after upload if available.*

---

## Risks / Edge Cases

- **Session-only data:** Detect relies on `sessionStorage`; navigating in a fresh tab or after clearing storage shows an empty-state until the user uploads again.  
- **Dashboard vs upload:** If the user opens Detect before any upload in that session, analysis is unavailable until a document is uploaded (by design).  
- **OpenRouter / model behavior:** Free-tier or overloaded models may still return malformed JSON (`PARSE_ERROR`) or throttle (`UPSTREAM_ERROR`); clients should surface `detail` when present.  
- **Translation pipeline:** Intentionally unchanged; only shared client session keys are reused for document text.

---

## Environment Variables Added or Changed

*No new variables.* Existing server expectations:

- `OPEN_ROUTER_API_TOKEN` — required for `/api/safety`

---

## Checklist

- [x] Lint passes (for touched files)
- [ ] Type check passes
- [ ] No console logs remain
- [ ] Deployment preview verified
