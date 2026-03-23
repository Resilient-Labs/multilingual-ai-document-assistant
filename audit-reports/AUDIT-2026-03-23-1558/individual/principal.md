# Principal Engineer Audit — Chunking Pipeline + Upload Wiring

**Auditor:** Principal Engineer (automated)
**Date:** 2026-03-23T15:58
**Scope:** 15 files — chunking, upload UI, extraction API, EntityDB, types

---

## Summary

| Severity | Count |
|----------|-------|
| 🔴 High | 2 |
| 🟡 Medium | 10 |
| 🔵 Low | 0 (not surfaced per instructions) |

---

## 🔴 High Severity

### H1 — Client/Server Contract Mismatch: MIME Types and File Size Limits

**Files:** `components/upload-form.tsx`, `lib/constants.ts`, `lib/documents/validation.ts`

The upload form and the server-side validation disagree on two critical constraints:

**MIME types:**
- The dropzone in `upload-form.tsx` (lines 128-134) accepts `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `text/plain`, and `image/*` (including `.heic`).
- The server (`lib/constants.ts` lines 14-19, enforced in `validation.ts` line 83) only allows `application/pdf`, `image/jpeg`, `image/png`, `image/webp`.
- **Impact:** A user can select a `.doc`, `.docx`, `.txt`, or `.heic` file, wait for upload, and receive a 400 error. This is a broken user flow.

**File size:**
- The dropzone `maxSize` is `10 * 1024 * 1024` (10 MB); the UI copy says "10 MB max" (lines 245, 314).
- The server enforces `MAX_FILE_SIZE_BYTES = 4.5 * 1024 * 1024` (4.5 MB) in `constants.ts` line 8.
- **Impact:** Files between 4.5 MB and 10 MB pass client-side validation but are rejected server-side.

**Recommendation:** Import `MAX_FILE_SIZE_BYTES` and `ALLOWED_MIME_TYPES` from `lib/constants.ts` into the upload form and derive the dropzone `accept` and `maxSize` from them. Alternatively, expand server-side allowed types if DOC/DOCX/TXT support is intended.

---

### H2 — Language Selection UI Is Non-Functional (Dead Feature)

**File:** `components/upload-form.tsx`

The form renders a complete language-selection UI with source/target language dropdowns and a swap button (lines 30-50, 149-201). State is tracked via `sourceLang` and `targetLang` hooks (lines 61-62). However:

- `handleSubmit` (lines 65-118) only appends the `file` to `FormData`. Neither `sourceLang` nor `targetLang` is sent to the API.
- The extraction endpoint (`app/api/documents/extract/route.ts`) has no parameter for language preference.
- No downstream consumer reads these values.

**Impact:** Users select translation languages, submit the form, and their language choice is silently discarded. This is a misleading UI that promises functionality it does not deliver.

**Recommendation:** Either wire `sourceLang`/`targetLang` into the FormData and propagate through the extraction response, or remove the language selection UI until the translation pipeline is ready. If deferred, replace with a disabled state and "coming soon" indicator.

---

## 🟡 Medium Severity

### M1 — Near-God Component: `upload-form.tsx` Mixes 6+ Responsibilities

**File:** `components/upload-form.tsx` (330 lines)

This single component handles:
1. Drag-and-drop file selection UI
2. Language selection state management
3. API call to `/api/documents/extract`
4. Construction of `CanonicalDocument`
5. EntityDB persistence (document + chunks)
6. Chunking orchestration (`chunkOCRResult` + `insertChunk`)
7. Post-submit navigation (`router.push`)
8. Responsive layout branching (mobile vs desktop)

At 330 lines and 6+ distinct responsibilities, this is on the edge of a God component. The submission logic (lines 65-118) alone is ~55 lines of orchestration that belongs in a custom hook.

**Recommendation:** Extract a `useDocumentUpload` hook (or similar) that owns the submit flow: API call → canonical construction → EntityDB persistence → chunking → navigation. The component should only own UI state and rendering.

---

### M2 — Three Overlapping Upload Routes (Dead Code / Tech Debt)

**Files:**
- `app/api/documents/extract/route.ts` — active, used by upload form
- `app/api/documents/upload/route.ts` — legacy, placeholder OCR, different response shape, 71 lines
- `app/api/upload/route.ts` — stub, returns `{ success: true }`, 7 lines

Only the `/api/documents/extract` route is wired to the UI. The other two are dead code with incompatible response contracts. They create confusion about which endpoint is canonical and add maintenance surface area.

**Recommendation:** Delete `app/api/documents/upload/route.ts` and `app/api/upload/route.ts`, or add deprecation headers and redirect if external consumers exist.

---

### M3 — Sequential Chunk Insertion (Performance)

**File:** `components/upload-form.tsx` (lines 107-109)

```typescript
for (const chunkText of chunks) {
  await insertChunk(chunkText, { docId: document.id });
}
```

Each chunk is inserted sequentially with an individual `await`. For a multi-page document with 20+ chunks, this serializes IndexedDB writes and embedding generation, blocking the UI thread. Each `insertChunk` triggers a separate embedding computation in the Xenova model.

**Recommendation:** Batch inserts using `Promise.all` (or a controlled concurrency pool if memory is a concern), or expose a `bulkInsert` method on EntityDB.

---

### M4 — Chunking Page-Boundary Drops Overlap Context

**File:** `lib/chunking.ts` (lines 120-124)

```typescript
if (buffer.trim()) {
  chunks.push(buffer.trim());
  buffer = "";
}
```

When a page boundary is reached, the buffer is emitted and reset to empty string — no overlap is seeded for the next page. Every other chunk transition (lines 115-117) correctly carries overlap, but the page boundary does not. This creates a retrieval gap at page boundaries in RAG — a query spanning a page break may miss relevant context.

**Recommendation:** Seed the buffer with overlap text from the emitted chunk at page boundaries, consistent with the mid-page logic.

---

### M5 — `alert()` for Error Handling (UX)

**File:** `components/upload-form.tsx` (lines 84, 114)

Errors from the extraction API and from caught exceptions are displayed using `alert()`. This is a blocking modal that provides poor UX — no ability to copy the error, no dismiss animation, and it interrupts the app flow.

**Recommendation:** Replace with a toast notification system (e.g., `sonner`, `react-hot-toast`) or inline error state rendered below the submit button.

---

### M6 — Duplicate Field Candidates from Overlapping Pattern Matchers

**File:** `lib/documents/fieldCandidates.ts`

When a block contains `Amount: $1,234.56`, the key-value pattern (line 13) extracts `key="Amount"`, `value="$1,234.56"`. The currency pattern (lines 44-53) independently extracts another candidate with `key="Amount"`, `value="$1,234.56"`. This produces duplicate entries for the same semantic field with different confidence scores.

Same issue applies to date fields matching both the key-value pattern and the date regex.

**Recommendation:** After key-value extraction, skip regex-based extraction for values already captured. Or deduplicate candidates by `(blockId, key)` before returning.

---

### M7 — No Entity Key on Chunk Inserts

**Files:** `lib/entitydb.ts` (lines 41-49), `components/upload-form.tsx` (lines 99-104 vs 107-109)

The canonical document is inserted with `entityKey: "extracted_document"`, but chunk inserts omit `entityKey`. This makes it impossible to filter or query chunks separately from documents in EntityDB without inspecting metadata fields.

**Recommendation:** Add `entityKey: "document_chunk"` (or similar) to chunk inserts for consistent entity classification.

---

### M8 — OCR Provider Hardcoded to Mock (No Env-Based Selection)

**File:** `lib/documents/provider.ts` (lines 108-115)

`getOCRProvider()` always returns `MockOCRProvider`. While `setOCRProvider()` exists (line 117), nothing calls it. There is no environment-variable-based provider selection (e.g., `OCR_PROVIDER=google-vision` → `GoogleVisionProvider`).

**Impact:** The extraction pipeline returns synthetic placeholder data in all environments. No path to production without code changes.

**Recommendation:** Add an env-var switch in `getOCRProvider()` (e.g., `process.env.OCR_PROVIDER`). Keep `MockOCRProvider` as the default for development, but log a warning when it's used outside of `NODE_ENV=development`.

---

### M9 — Partial Write Risk in Submission Flow

**File:** `components/upload-form.tsx` (lines 99-109)

The submission flow performs three sequential writes:
1. Insert canonical document into EntityDB (line 100)
2. Insert chunks one-by-one (lines 107-109)
3. Navigate to document page (line 111)

If chunk insertion fails mid-way (e.g., chunk 5 of 20), the canonical document and first 4 chunks are already persisted, but the user sees an error alert. On retry, a new document with a new ID is created, leaving orphaned partial data from the first attempt.

**Recommendation:** Wrap the entire persistence sequence in a transaction-like pattern. At minimum, generate the document ID client-side before persistence and use upsert semantics, so retries overwrite rather than duplicate.

---

### M10 — `fallbackChunkFullText` Has Excessive Nesting / Branching (Tech Debt Signal)

**File:** `lib/chunking.ts` (lines 22-63)

This function has 4 levels of nesting and 7+ branch points across 40 lines:
- `for` → `if/continue` → `if/else` → `for` → `if/else` → `if/else`

The inner sentence-splitting loop (lines 43-57) duplicates the buffer-emit-overlap pattern from the outer paragraph loop. This is duplicated logic (~10 lines repeated) that could be extracted into a shared helper.

**Recommendation:** Extract a `emitBufferWithOverlap(buffer, chunks)` helper. Consider refactoring the paragraph+sentence splitting into a single flattened token stream before applying the sliding-window chunker.

---

## Files With No Issues

The following files were reviewed and found to be clean:

- ✅ `lib/documents/errors.ts` — Well-structured error helpers, consistent shape.
- ✅ `lib/documents/validation.ts` — Clean discriminated union pattern, proper early returns.
- ✅ `lib/documents/normalize.ts` — Clear responsibility, proper ID generation.
- ✅ `lib/documents/index.ts` — Clean barrel export.
- ✅ `types/index.ts` — Well-organized entity model (minor: `BoundingBox` vs `NormalizedBoundingBox` are structurally identical, but this is low severity).
- ✅ `types/CanonicalDocument.ts` — Clean type composition.

---

*End of Principal Engineer Audit*
