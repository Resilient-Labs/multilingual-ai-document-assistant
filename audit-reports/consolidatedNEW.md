## PR: Text chunking utility + EntityDB RAG wiring (Team 3)

**Branch:** `feature/team-3-text-chunking-utility`  
**Range:** `09f36063760fd12014dbcb78d8d8a1e039733627` → `febf8c4d4551a5038421dfc6c084dbddaa07811c` (inclusive)

This section documents what landed on that branch. It is aligned with the **Chunking & Upload Wiring** audit: see `audit-reports/AUDIT-2026-03-27-1430/consolidated/CONSOLIDATED.md`.

### Summary

This work delivers a **text chunking path for RAG**: `chunkText()` lives under `lib/`, runs at persist time, and each chunk is stored via **`insertChunk()`** so EntityDB can embed and serve semantic search. The same commits also **align upload/extraction with the canonical `/api/documents/extract` route**, add **rate limiting** for CPU-heavy extraction, **refactor the upload UI** into a hook plus shared language control, fix **client vs server max file size**, and improve **upload error announcement** for assistive tech.

### Top 5 Must-Fix Items

The following issues were flagged 🔴 High severity across the Principal Engineer, Security, and DevOps audits run against this commit range (`09f36063..f074c1de`). Full details in `audit-reports/AUDIT-2026-03-30-1244/consolidated/CONSOLIDATED.md`.

| # | Severity | File(s) | Issue | Fix |
|---|----------|---------|-------|-----|
| 1 | 🔴 High | `lib/documents/provider.ts` | **MockOCRProvider is the production default.** `getOCRProvider()` always falls back to `MockOCRProvider`, which returns empty text. No production code calls `setOCRProvider()` — only tests do. Every document upload silently produces empty OCR output in production. | Change the default to `new CompositeOCRProvider()`, or throw a configuration error when no provider is set. Restrict `MockOCRProvider` to `NODE_ENV === 'test'` only. |
| 2 | 🔴 High | `app/api/documents/upload/route.ts`, `middleware.ts` | **No authentication on upload/extract routes.** Neither `/api/documents/upload` nor `/api/documents/extract` checks user identity. Any unauthenticated request from the internet can submit arbitrary files and trigger OCR processing, exhausting compute/API quotas. | Add a session check at the top of the POST handler: `const session = await getServerSession(authOptions); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });` |
| 3 | 🔴 High | `middleware.ts` | **Rate limiter is broken in production on two fronts.** (a) `x-forwarded-for` is fully attacker-controllable — any client can spoof a fresh IP on every request and bypass the 15-req/min limit entirely. (b) The in-memory `Map` resets on every serverless cold start, making the limit silently ineffective at scale. The Map also has no eviction, causing a memory leak under many unique IPs. | Use the platform-provided `req.ip` (Vercel) or validate proxy depth. Replace the Map with a distributed atomic counter (e.g., `@upstash/ratelimit` with Vercel KV or Redis). |
| 4 | 🔴 High | `hooks/useDocumentUpload.ts` | **God hook (≥7 responsibilities) with silent fire-and-forget embedding.** `useDocumentUpload.submit` orchestrates logging, client OCR, HEIC decoding, server upload, entity DB persistence, text chunking/vector insertion, session storage, and navigation in one 152-line function. Chunking/embedding failures only surface as `console.error` after the user navigates away, leaving documents silently non-queryable for RAG. | Extract `useImageOCR` and `useDocumentPersistence` sub-hooks. Await or queue the chunking/embedding step with retry logic and a user-visible failure notification. |
| 5 | 🟡 Medium | `lib/documents/provider.ts` | **Tesseract hard-codes `"eng"` in a multilingual app.** `TesseractOCRProvider` always calls `createWorker("eng")`. The app supports 19 languages, but Arabic, Chinese, Japanese, Korean, Hindi, and others will produce near-empty or garbled OCR. `sourceLang` from the client is never forwarded to the server OCR provider. | Add an optional `language` parameter to `OCRProvider.extract` (or the constructor), map UI language codes to Tesseract language codes, and propagate `sourceLang` through the call chain. |

---

### Ticket alignment (audit “Top 5”)

| Audit item | What shipped in this range |
|------------|----------------------------|
| Move and wire `lib/chunking.ts`; call `chunkText` on persist; chunks through embedding path | `chunking.ts` moved to `lib/`; `persistOCRToEntityDB` calls `chunkText(fullText)` and `insertChunk` per chunk with `docId` / `chunkId`. |
| Rate limit extraction endpoints | `middleware.ts`: sliding window per client IP on `POST` to `/api/documents/extract` and `/api/documents/upload` (429 + `Retry-After`). |
| Align file size limits (UI vs server) | Dropzone `maxSize` and copy use `MAX_FILE_SIZE_BYTES` from `lib/constants.ts` (4.5 MB), same as the API. |
| `role="alert"` / live region for errors | Error container uses `role="alert"`, `aria-live="assertive"`, `aria-atomic="true"`; styling hides the empty state without removing the live region. |
| Overlap between `/upload` and `/extract` | `/api/documents/upload` is a **deprecated thin wrapper** that delegates to the extract handler and sets `Deprecation`, `Sunset`, and `Link: successor-version` headers; README documents `/extract` as canonical. |

### Implementation details

**Chunking (`lib/chunking.ts`)**

- `chunkText(text, { chunkSize?, chunkOverlap? })` — pure; usable from client or server.
- Defaults: **500** characters per chunk, **100** overlap; stride = `chunkSize - chunkOverlap` (minimum 1).
- Short text: single chunk `chunk_0` after trim; empty input yields `[]`.
- `tokenCount` uses `ceil(length / 4)` (heuristic, not a real tokenizer).

**RAG persistence (`lib/entitydb-persist.ts`)**

After the IndexedDB write for the extracted document payload:

1. Runs `chunkText(params.ocr.fullText)`.
2. For each chunk, `await insertChunk(chunk.text, { docId, chunkId: chunk.id })` so records use `EntityDB.insert()` and the embedding path behind `queryChunks`.

The canonical document row still uses a **placeholder vector** for that record; **chunk rows** back meaningful similarity search.

**Upload / extraction**

- `hooks/useDocumentUpload.ts` — submit, OCR progress, `persistOCRToEntityDB`, session keys, navigation. Images: Tesseract + `prepareImageBytes` in `lib/image-utils.ts` (HEIC/HEIF → JPEG). Documents: `POST /api/documents/extract`, then persist.
- `lib/documents/provider.ts` — default provider is `CompositeOCRProvider` (images → `TesseractOCRProvider`, PDF/DOC/DOCX/TXT → `DocumentTextProvider`).
- `components/upload-form.tsx` — dropzone, `LanguageSelector`, delegates to the hook.
- `app/api/documents/upload/route.ts` — delegates to the extract handler; deprecation headers and console warning.

**Ops / UX**

- `middleware.ts` — in-memory per-IP counters (suitable for single-instance dev; revisit for multi-node deploys).
- `app/page.tsx` — marketing copy uses `maxSizeLabel` from `MAX_FILE_SIZE_BYTES`.

**Process artifacts**

Commit `aca812b` also adds Cursor audit command templates, debug log snapshots, and `audit-reports/AUDIT-2026-03-27-1430/` (consolidated + individual audits). These are documentation/process tooling, separate from runtime behavior.

### Commit log (chronological)

| Commit | Summary |
|--------|---------|
| `09f3606` | Introduces `chunkText` under `multilingual-ai-document-assistant/lib/chunking.ts` (initial location). |
| `aca812b` | Moves `chunking.ts` → `lib/chunking.ts`; wires `persistOCRToEntityDB` to chunk + `insertChunk`; adds audit/Cursor artifacts above. |
| `ce9e1ef` | Rate limiting middleware; README canonical `/extract`; deprecates `/upload`; upload refactor (hook, `LanguageSelector`, `image-utils`); `CompositeOCRProvider` / `DocumentTextProvider`. |
| `febf8c4` | Unifies max file size (dropzone + copy) with `MAX_FILE_SIZE_BYTES`; live region refinement for upload errors; homepage copy uses shared limit. |

### How to verify

1. Upload a long PDF or DOCX → multiple chunk entities; `queryChunks` returns sensible similarity for matching queries.
2. Upload an image → OCR path persists and chunks recognized text.
3. File over 4.5 MB → rejected in dropzone before API.
4. Many rapid `POST /api/documents/extract` calls → 429 after threshold within the window.
5. `POST /api/documents/upload` → same behavior as extract + deprecation headers.

### Files worth a close review

- `lib/chunking.ts`, `lib/entitydb-persist.ts`, `lib/entitydb.ts` (`insertChunk` / `queryChunks`)
- `middleware.ts`
- `hooks/useDocumentUpload.ts`, `lib/documents/provider.ts`
- `app/api/documents/upload/route.ts`

---
