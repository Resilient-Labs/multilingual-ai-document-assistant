# Principal Engineer Audit — Chunking and Upload Wiring

**Date:** 2026-03-27 14:30  
**Auditor role:** Principal Engineer  
**Scope:** Chunking pipeline, upload form wiring, EntityDB persistence, extraction API, types, and config

## Summary

| Severity | Count |
|----------|-------|
| 🔴 High | 4 |
| 🟡 Medium | 5 |
| 🔵 Low | 2 |

---

## 🔴 High Severity

### H1 — `chunking.ts` is orphaned and the RAG chunking pipeline is unwired

**Files:** `multilingual-ai-document-assistant/lib/chunking.ts`, `components/upload-form.tsx`, `lib/entitydb-persist.ts`

The plan specifies `lib/chunking.ts` but the file lives at `multilingual-ai-document-assistant/lib/chunking.ts` — a misplaced path outside the project's main source tree. **Nothing imports `chunkText` anywhere in the codebase.** The upload pipeline stores the entire document as a single OCR block with no chunking. The stated goal — "OCR text chunking for RAG" — is not implemented in the wiring.

**Impact:** Semantic search over chunks (the core of the RAG pipeline) is inoperable. Documents are stored whole rather than as overlapping chunks.

**Recommendation:**
1. Move `multilingual-ai-document-assistant/lib/chunking.ts` → `lib/chunking.ts`.
2. Call `chunkText(fullText)` in `persistOCRToEntityDB` (or in the upload form before persist) and store each chunk as a separate EntityDB record with a real embedding.

---

### H2 — Placeholder vectors bypass the embedding pipeline entirely

**File:** `lib/entitydb-persist.ts` (lines 17–23, 109–132)

`persistOCRToEntityDB` writes directly to the raw IDB `vectors` store with a uniform placeholder vector (`1/√384` in every dimension). It deliberately bypasses EntityDB's `insert()` method — which generates real embeddings — to "avoid triggering the ML embedding pipeline." This means:

- `queryChunks()` in `entitydb.ts` will return **meaningless cosine similarity scores** because every stored vector is identical.
- The entire vector store is semantically inert.

This contradicts the architecture note in `entitydb.ts` ("EntityDB stores chunks + embeddings for RAG").

**Impact:** Semantic search is non-functional. All documents appear equally similar to every query.

**Recommendation:** Use `EntityDB.insert()` for chunk-level records (after implementing H1) so real embeddings are generated. Reserve the raw IDB write only for metadata-only records that don't need embedding.

---

### H3 — `upload-form.tsx` is a God component (430+ lines, 6+ responsibilities)

**File:** `components/upload-form.tsx`

This single component handles:
1. HEIC image detection and conversion (`prepareImageBytes`, lines 32–68)
2. Client-side OCR orchestration via Tesseract.js (lines 125–143)
3. Server-side upload via `fetch("/api/documents/upload")` (lines 172–191)
4. EntityDB persistence orchestration (`persistOCRToEntityDB`, lines 161–169, 183–191)
5. Language selection UI (lines 238–291)
6. Two complete layout variants — mobile and desktop (lines 304–425)

The `handleSubmit` function alone is ~95 lines with branching on `isImage` for two entirely different code paths (client-side OCR vs. server upload). This violates single responsibility and makes the component hard to test, review, and extend.

**Recommendation:** Extract:
- `prepareImageBytes` → `lib/image-utils.ts`
- OCR + upload orchestration → `hooks/useDocumentUpload.ts` custom hook
- Language selector → `components/language-selector.tsx`
- Persistence call → keep in hook or dedicated persist utility

---

### H4 — Two overlapping extraction API routes with unclear ownership

**Files:** `app/api/documents/upload/route.ts`, `app/api/documents/extract/route.ts`

Two separate POST endpoints perform document text extraction:

| Route | Multi-file | OCR Provider | Field Extraction | Used by |
|-------|-----------|--------------|-----------------|---------|
| `/api/documents/upload` | No | Inline (`mammoth`, `word-extractor`, `extractPdfText`) | No | `upload-form.tsx` |
| `/api/documents/extract` | Yes | Provider-based (`getOCRProvider()`) | Yes (`extractFieldCandidates`) | **Nothing** |

The upload form uses the simpler `/upload` route, but `/extract` is more capable and returns a proper `ExtractionResponse` with field candidates. Having two routes that do the same thing at different sophistication levels will cause drift and confusion about which is canonical.

**Impact:** Field extraction and multi-file support are dead code. New developers won't know which route to use.

**Recommendation:** Converge on one extraction endpoint. Either upgrade `/upload` to use the provider/normalizer pipeline from `/extract`, or wire the upload form to use `/extract` and deprecate `/upload`.

---

## 🟡 Medium Severity

### M1 — Duplicated `EntityDBInternal` interface and IDB access pattern

**Files:** `lib/entitydb-persist.ts` (lines 38–56), `hooks/useDocumentSession.ts` (lines 26–37)

The `EntityDBInternal` type (internal IDB shape), the raw-IDB access pattern, and the record-filtering logic (find by `entityKey`, strip `id`/`vector`/`entityKey`/`text`) are copy-pasted between these two files.

**Recommendation:** Extract a shared `lib/entitydb-internal.ts` module with:
- The `EntityDBInternal` type
- A `getIdb()` helper
- A `findDocumentRecord(docId?)` function

---

### M2 — Dual-storage anti-pattern: `sessionStorage` + EntityDB

**File:** `components/upload-form.tsx` (lines 194–199)

After persisting to EntityDB, the upload form also writes to `sessionStorage`:
```
sessionStorage.setItem(`translate-${docId}`, JSON.stringify({ fullText, filename, sourceLang, targetLang }));
sessionStorage.setItem("current-doc-id", docId);
```

Downstream, `useDocumentSession` reads from EntityDB, **not** from `sessionStorage`. This creates two sources of truth. If one write succeeds and the other fails, the app state is inconsistent. The `sessionStorage` write appears to be a legacy transport mechanism that predates the EntityDB wiring.

**Recommendation:** Remove the `sessionStorage` writes if EntityDB is the canonical store, or document the intentional dual-write pattern with the translate page's expectations.

---

### M3 — Unsafe `as unknown as` casts for EntityDB internals

**Files:** `lib/entitydb-persist.ts` (line 54), `hooks/useDocumentSession.ts` (line 66)

Both files cast `EntityDB` to `unknown` then to `EntityDBInternal` to access `dbPromise`. This is a fragile coupling to the library's private API surface. Any version bump of `@babycommando/entity-db` that renames or restructures `dbPromise` will silently break at runtime with no compile-time error.

**Recommendation:** Pin the EntityDB version explicitly in `package.json` and add an integration test that asserts `dbPromise` exists. Long-term, request an official low-level API from the library or wrap the access in a single guarded utility (see M1).

---

### M4 — No error recovery for IndexedDB write failures in persistence

**File:** `lib/entitydb-persist.ts` (lines 123–133)

`persistOCRToEntityDB` performs a single `store.add(record)` with no error handling for IndexedDB-specific failures (quota exceeded, transaction abort, private browsing restrictions). If the write fails, the `catch` in `upload-form.tsx` shows a generic error, but the user has no way to retry without re-uploading and re-running OCR.

**Recommendation:** Add targeted error handling in `persistOCRToEntityDB` that distinguishes quota errors (prompt user to clear data) from transient failures (offer retry). Consider returning the built `CanonicalDocument` so the caller can retry persistence without re-running OCR.

---

### M5 — Tesseract OCR confidence values discarded

**File:** `components/upload-form.tsx` (lines 148–158)

Client-side image OCR via Tesseract.js returns per-word/per-block confidence values, but the upload form constructs a single OCR block with hardcoded `confidence: 1.0`:
```typescript
blocks: [{ id: "b1", documentId: docId, text: fullText, confidence: 1.0 }]
```

This loses real confidence data that could be used downstream for quality indicators or re-scan prompts.

**Recommendation:** Use `data.confidence` from Tesseract's response as the block confidence. If per-word confidence is available, consider mapping to multiple `OCRBlock` entries.

---

## 🔵 Low Severity

### L1 — `logDocumentSubmission` fires before file null-check

**File:** `components/upload-form.tsx` (lines 112–113)

```typescript
logDocumentSubmission(sourceLang, targetLang).catch(() => {});
if (!file) return;
```

The analytics event fires even when no file is selected, creating noise. Move the log call after the `!file` guard.

---

### L2 — `next.config.js` silently disables `onnxruntime-node` and `sharp`

**File:** `next.config.js` (lines 6–7)

Aliasing `onnxruntime-node` and `sharp` to `false` suppresses build-time errors but means any server-side code that imports these packages will get `false` at runtime instead of a clear error. This could cause confusing failures if a future feature depends on server-side ONNX inference.

**Recommendation:** Add a comment explaining why these are disabled, and consider a runtime guard that throws a descriptive error if these modules are accessed.

---

## Architecture Notes (Informational)

### Chunk type has `documentId` gap

The `Chunk` interface in `types/index.ts` has `id`, `text`, and `tokenCount` but no `documentId` field. When chunks are stored in EntityDB, there's no type-level guarantee that they're associated with a document. The `insertChunk` function in `entitydb.ts` passes `docId` as metadata, but this isn't reflected in the `Chunk` type.

### `tokenCount` estimation is naive

`chunking.ts` estimates token count as `Math.ceil(text.length / 4)`. This is a rough heuristic for English text (where ~4 chars ≈ 1 BPE token) but will over-count for CJK languages where each character is typically 1–2 tokens. For a multilingual document assistant, this could cause misleading chunk size reporting.

---

```
═══════════════════════════════════════════════════════
PRINCIPAL ENGINEER AUDIT — Chunking & Upload Wiring
2026-03-27 14:30
🔴 High: 4  🟡 Medium: 5  🔵 Low: 2
═══════════════════════════════════════════════════════
```
