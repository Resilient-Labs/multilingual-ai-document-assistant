# Pull Request: Chunking Pipeline + Upload Wiring

**Branch:** `feature/team-3-chunking-pipeline-upload-wiring`
**Base:** `main`
**Commits:** `cd1e39c` → `97443e1` (8 commits)

---

## Summary

This PR implements the end-to-end upload-to-chunking pipeline for document translation. It replaces the placeholder `handleSubmit` in the upload form with a real flow that extracts document content via the `/api/documents/extract` endpoint, persists the result as a `CanonicalDocument` in EntityDB, chunks the OCR output, inserts each chunk into the vector store, and redirects the user to `/document/[id]`. Following the initial wiring, a series of targeted fixes address findings from the consolidated audit report (AUDIT-2026-03-23-1558), including client/server contract mismatches, a RAG chunking gap, accessibility violations, and poor error UX. A full Playwright e2e test suite is added to lock in the fixes.

---

## What Changed

### 1. Upload Form Wiring (`components/upload-form.tsx`)

**Commit:** `aacfb31` — *Wire up upload-form.tsx handleSubmit*

The placeholder `alert()` stub and TODO comment block in `handleSubmit` were replaced with the full submission pipeline:

- **POST to `/api/documents/extract`** — sends the selected file as `FormData`
- **Build a `CanonicalDocument`** — assembles the extraction response (`document`, `ocr`, `files`, `fieldCandidates`, `extractedAt`) into a canonical shape
- **Persist to EntityDB** — inserts the canonical document with `entityKey: "extracted_document"`
- **Chunk and insert** — calls `chunkOCRResult(ocr)` and inserts each chunk via `insertChunk()` with the `docId` metadata
- **Redirect** — navigates to `/document/${document.id}` via Next.js `useRouter`

New imports: `useRouter`, `toast` (sonner), `getEntityDB`, `insertChunk`, `chunkOCRResult`, `MAX_FILE_SIZE_BYTES`, and the `ExtractionResponse` / `CanonicalDocument` types.

---

### 2. Client/Server Validation Alignment

**Commit:** `1f891bf` — *fix: align upload validation with client (4.5MB, MIME types)*

**Files:** `lib/constants.ts`, `lib/documents/errors.ts`, `lib/documents/validation.ts`, `app/api/documents/upload/route.ts`

The audit flagged a contract mismatch (H1): the client dropzone accepted DOC, DOCX, TXT, and HEIC files and showed "10 MB max," but the server only allowed PDF, JPEG, PNG, and WebP at 4.5 MB. This commit:

- **Expanded `ALLOWED_MIME_TYPES`** in `lib/constants.ts` to include `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `text/plain`, and `image/heic`
- **Updated the dropzone** `maxSize` to use `MAX_FILE_SIZE_BYTES` (4.5 MB) from the shared constant instead of a hardcoded `10 * 1024 * 1024`
- **Updated UI copy** from "10 MB max" to "4.5 MB max" in both mobile and desktop views
- **Updated error messages** in `lib/documents/errors.ts`, `lib/documents/validation.ts`, and `app/api/documents/upload/route.ts` to list all accepted types: "PDF, DOC, DOCX, TXT, JPEG, PNG, WebP, HEIC"

---

### 3. Chunking Page-Boundary Overlap Fix (`lib/chunking.ts`)

**Commit:** `35f8f32` — *Chunking page-boundary drops overlap context (RAG gap)*

The audit (M4) identified that when the chunker hit a page boundary, it emitted the current buffer and reset `buffer = ""`, discarding the overlap window. This created a context gap at every page transition — a significant problem for RAG retrieval that depends on overlapping context between chunks.

The fix seeds the next page's buffer with the trailing overlap from the previous page:

```typescript
// Before: buffer = "";
// After:
const overlap = lastNCharsAtWordBoundary(buffer, CHUNK_OVERLAP);
buffer = overlap;
```

---

### 4. Replace `alert()` with Toast Notifications

**Commit:** `6b6c787` — *alert() for error handling (poor UX)*

**Files:** `components/upload-form.tsx`, `app/layout.tsx`

The audit (M5) flagged the use of `alert()` for error display. This commit:

- Replaced both `alert(message)` calls in `handleSubmit` (API error and catch block) with `toast.error(message)` using sonner
- Added the `<Toaster />` provider to `app/layout.tsx` so toasts render globally

---

### 5. Structured Error Logging in Extract Route (`app/api/documents/extract/route.ts`)

**Commit:** `af48f19` — *Extract route outer catch drops errors with no logging*

The audit (D-H2) flagged that the outer `catch` block in the extract API route swallowed errors silently — a production 500 would be completely invisible. This commit:

- Captures the error object (`catch (err)` instead of bare `catch`)
- Logs a structured JSON message with `level`, `route`, and `message` via `console.error`

---

### 6. Fix Nested Interactive Elements (`components/upload-form.tsx`)

**Commit:** `522881a` — *Nested interactive elements — buttons inside dropzone*

The audit (A-H1) flagged a WCAG 4.1.2 violation: `react-dropzone` applies `role="button"` to the dropzone container, which contained nested `<button>` elements (Browse files / Take a photo). This creates invalid HTML and confusing screen reader behavior. This commit:

- Overrides the dropzone role to `role="presentation"` via `getRootProps({ role: "presentation" })` on both mobile and desktop dropzone containers
- Extracts the `open` method from `useDropzone` and wires it directly to the Browse/Camera button `onClick` handlers, so file selection still works without relying on the container's click-to-open behavior

---

### 7. Inline Error Display with ARIA (`components/upload-form.tsx`)

**Commit:** `1c17ac7` — *Errors surfaced only with alert() — no in-page status pattern*

The audit (A-M1) flagged the lack of an in-page error pattern per WCAG 3.3.1. This commit:

- Adds `errorMessage` state that is set alongside every `toast.error()` call and cleared on re-submission (`setErrorMessage(null)`)
- Renders an inline `<p>` with `role="alert"` and `aria-live="assertive"` above the submit button (in both mobile and desktop layouts) when an error exists

---

### 8. E2E Test Suite + Playwright Setup

**Commit:** `97443e1` — *fix(e2e): scope role=alert locators to exclude next-route-announcer strict mode violations*

Adds a full Playwright e2e test suite validating all audit fixes and the core upload pipeline:

| Spec File | Tests | Coverage |
|-----------|-------|----------|
| `audit-upload.spec.ts` | 5 tests | Home page loads, file select, file remove, submit gating, full extract → redirect |
| `audit-validation.spec.ts` | 4 tests | Missing file → 400, bad MIME → 400, oversized → 400, valid PDF → 200 |
| `audit-error-handling.spec.ts` | 3 tests | Toast (not `alert()`), inline `role="alert"`, error clears on retry |
| `audit-accessibility.spec.ts` | 5 tests | No nested `role="button"`, browse button not nested, swap/remove ARIA labels, inline error ARIA |
| `audit-security.spec.ts` | 2 tests | Stub endpoint baseline, structured error JSON for bad input |
| `audit-document.spec.ts` | 4 tests | Document page renders, 404 for missing ID, extracted fields tab, form validation |

Infrastructure added:

- `playwright.config.ts` — single Chromium project, auto-starts dev server, HTML + list reporters
- `@playwright/test` dev dependency
- `.gitignore` entries for `playwright-report/`, `test-results/`, `e2e/.auth/`
- `e2e/fixtures/sample.pdf` test fixture
- Alert locators scoped with `:not(#__next-route-announcer__)` to avoid Playwright strict-mode violations from Next.js internal ARIA elements

---

## Audit Findings Addressed

| Audit ID | Severity | Finding | Resolution |
|----------|----------|---------|------------|
| H1 (Principal, DevOps, Patterns) | High | Client/server contract mismatch on MIME types and file size | Aligned `ALLOWED_MIME_TYPES` + `MAX_FILE_SIZE_BYTES` across client and server |
| D-H2 (DevOps) | High | Extract route outer catch drops errors silently | Added structured `console.error` logging with route context |
| A-H1 (Accessibility) | High | Nested interactive elements — buttons inside `role="button"` dropzone | Dropzone role overridden to `presentation`; `open` wired to button `onClick` |
| M4 (Principal) | Medium | Chunking page-boundary drops overlap context (RAG gap) | Page boundary now seeds next buffer with trailing overlap |
| M5 (Principal) | Medium | `alert()` for error handling | Replaced with `toast.error()` via sonner |
| A-M1 (Accessibility) | Medium | No in-page error status pattern (WCAG 3.3.1) | Added inline `role="alert"` error display with `aria-live="assertive"` |

---

## Files Changed (26 files, +1,460 / −31)

| Category | Files |
|----------|-------|
| **Core pipeline** | `components/upload-form.tsx`, `lib/chunking.ts`, `lib/constants.ts` |
| **API routes** | `app/api/documents/extract/route.ts`, `app/api/documents/upload/route.ts` |
| **Validation / errors** | `lib/documents/errors.ts`, `lib/documents/validation.ts` |
| **Layout** | `app/layout.tsx` |
| **E2E tests** | `e2e/audit-upload.spec.ts`, `e2e/audit-validation.spec.ts`, `e2e/audit-error-handling.spec.ts`, `e2e/audit-accessibility.spec.ts`, `e2e/audit-security.spec.ts`, `e2e/audit-document.spec.ts` |
| **Test infra** | `playwright.config.ts`, `e2e/fixtures/sample.pdf`, `package.json`, `package-lock.json` |
| **Audit reports** | `audit-reports/AUDIT-2026-03-23-1558/` (6 files — consolidated + individual role reports) |
| **Config** | `.gitignore` |

---

## Test Plan

- [ ] `npx playwright test` — all 23 e2e tests pass
- [ ] Upload a valid PDF and confirm redirect to `/document/[id]`
- [ ] Upload an oversized file (>4.5 MB) and confirm the 400 rejection + inline error
- [ ] Upload an unsupported file type and confirm the MIME type error
- [ ] Trigger a server error and verify toast notification appears (no browser `alert()`)
- [ ] Verify screen reader announces the inline error on failed submission
- [ ] Confirm the "Browse files" button opens the file picker without nested interactive warnings in dev tools
- [ ] Inspect chunking output across page boundaries and verify overlap context is preserved

---

## Known Limitations (Out of Scope)

These audit findings were **not** addressed in this PR and remain open:

- **SEC-1:** No authentication on API routes
- **H2:** Language selection UI is non-functional (source/target dropdowns not wired to API)
- **M1:** `upload-form.tsx` is a near-God component (~330 lines, 6+ responsibilities)
- **M3:** Sequential chunk insertion (could be parallelized with `Promise.all`)
- **SEC-3 / D-M1 / D-M2:** No rate limiting or timeouts on extraction endpoints
