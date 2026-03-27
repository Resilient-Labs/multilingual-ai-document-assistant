# DRY / Patterns Audit — Chunking & Upload Wiring Scope

**Scope:** `components/upload-form.tsx`, `multilingual-ai-document-assistant/lib/chunking.ts`, `lib/entitydb.ts`, `lib/entitydb-persist.ts`, `types/index.ts`, `types/CanonicalDocument.ts`, `app/api/documents/extract/route.ts`, `hooks/useDocumentSession.ts`, `next.config.js`  
**Role:** Patterns & Abstraction Auditor (per `.cursor/commands/audit-dry.md`)  
**Date:** 2026-03-27

---

## 🔴 High — Configuration duplication with conflicting values

```
// 🔴 [DRY / CONFIG] Client upload limit and UI copy do not share server constants.
//    upload-form.tsx: react-dropzone maxSize = 10 * 1024 * 1024; UI strings say "10MB max".
//    lib/constants.ts: MAX_FILE_SIZE_BYTES = 4.5 MB; app/api/documents/upload/route.ts enforces it.
//    Consolidate: import MAX_FILE_SIZE_BYTES (or a shared exported client-safe constant) for maxSize
//    and update all user-visible limit strings to match. Cross-ref: lib/constants.ts, upload/route.ts.
```

Users can select files the server rejects; duplicated “max size” knowledge diverges.

---

## 🟡 Medium — Active duplication (maintenance risk)

### M1 — Raw IndexedDB access and canonical record shaping (EntityDB “escape hatch”)

```
// 🟡 [DRY] Duplication: EntityDBInternal interface + casting getEntityDB() + dbPromise + transaction("vectors")
//    + getAll() + find by entityKey + document.id match + strip id/vector/entityKey/text from payload.
//    Files: lib/entitydb-persist.ts (getIdb, getDocumentFromEntityDB) and hooks/useDocumentSession.ts (inline in useEffect).
//    entitydb-persist.ts also types objectStore.add for writes; hook’s EntityDBInternal omits add — near-identical types drift risk.
//    Consolidate into: lib/entitydb-idb.ts (or extend entitydb-persist.ts) with:
//      - getVectorsStore(mode), findExtractedDocumentRecord(docId?: string), toCanonicalPayload(record)
//    Usage: persistOCRToEntityDB keeps write path; useDocumentSession calls shared reader + mapper only.
```

### M2 — Same magic string for entity key, two constants

```
// 🟡 [DRY] Duplication: "extracted_document" defined as EXTRACTED_DOCUMENT_ENTITY_KEY (entitydb-persist.ts)
//    and EXTRACTED_DOCUMENT_KEY (useDocumentSession.ts).
//    Consolidate: single exported const from lib/entitydb-persist.ts (or lib/entitydb-constants.ts) imported by the hook.
```

### M3 — Single-block OCRResult construction

```
// 🟡 [DRY] Duplication: OCRResult with one block id "b1", fullText, confidence 1.0 appears in:
//    components/upload-form.tsx (client image OCR path, ~lines 147–158)
//    app/api/documents/upload/route.ts (~lines 110–122)
//    Consolidate into: lib/documents/buildMinimalOCRResult(docId, fullText) or reuse normalizeOCRResult patterns
//    from lib/documents where appropriate (upload route may stay thin by calling shared helper).
```

### M4 — Two server extraction surfaces (conceptual / API DRY)

```
// 🟡 [DRY] Overlap: POST /api/documents/extract (OCR provider, normalizeOCRResult, shared validation)
//    vs POST /api/documents/upload (PDF/mammoth/word text extraction, different limits messaging).
//    upload-form.tsx only calls /api/documents/upload for non-images — extract route unused by this flow.
//    Long-term: one documented primary API + shared validation/helpers, or explicit deprecation of the duplicate path.
//    Note: extract/route.ts is in scope; upload/route.ts is coupled behavior worth aligning in a follow-up audit.
```

---

## 🔵 Low — Abstraction and reuse opportunities

### L1 — `chunkText` is unused; path does not match planned `lib/chunking.ts`

```
// 🔵 [DRY] chunkText in multilingual-ai-document-assistant/lib/chunking.ts is not imported anywhere.
//    No chunking in persistOCRToEntityDB or upload-form — whole-document single vector row only.
//    Extract as: move to lib/chunking.ts (or re-export) and call from one persistence path when RAG chunks are stored.
```

### L2 — `useDocumentSession` could delegate to `getDocumentFromEntityDB`

```
// 🔵 [DRY] After M1 consolidation, hook becomes thin: loading/error/cancel + getDocumentFromEntityDB(sessionId).
//    Avoids parallel implementations of the same lookup semantics.
```

### L3 — Hardcoded API path

```
// 🔵 [DRY] fetch("/api/documents/upload" ...) in upload-form.tsx — consider shared ROUTES or API_ENDPOINTS
//    constant if multiple callers exist or tests mock paths.
```

### L4 — Mobile vs desktop JSX in `UploadForm`

```
// 🔵 [DRY] Component extraction: duplicated dropzone + file chip patterns (~60+ lines each branch) with className variants.
//    Extract: UploadDropzoneZone, SelectedFileChip, or single component with mobile prop (matches existing TranslationDirection pattern).
```

### L5 — Chunking defaults vs future shared config

```
// 🔵 [DRY] chunking.ts defaults (chunkSize 500, overlap 100) are local; if wired, align with any server/RAG config
//    in lib/constants.ts to avoid two sources of truth for chunk policy.
```

### L6 — `lib/entitydb.ts` vs placeholder embedding dimension

```
// 🔵 [DRY] entitydb.ts uses EMBEDDING_MODEL "Xenova/all-MiniLM-L6-v2"; entitydb-persist.ts documents 384-dim placeholder.
//    If model changes, two places must update — consider exporting EMBEDDING_VECTOR_DIM from one module derived from model choice.
```

### L7 — `next.config.js`

```
// 🔵 [DRY] No duplication within scope; webpack aliases are localized. No action unless other configs repeat the same ignores.
```

### L8 — `types/index.ts` / `CanonicalDocument.ts`

```
// 🔵 [DRY] Clean separation: CanonicalDocument composes types from index — good reuse, no duplicate type definitions found.
```

---

## Checklist (scope-relevant)

| Checklist item | Result |
|----------------|--------|
| Same logic 2+ times in one file | upload-form: mobile/desktop dropzone blocks (L4) |
| Similar switch/if chains | extract/route: validation switch — single place; OK |
| Same transforms in multiple places | OCR single-block (M3); IDB payload strip (M1) |
| Repeated fetch + error handling | upload-form: one fetch path; could share with future hooks |
| Route/API strings scattered | `/api/documents/upload` (L3) |
| Types in multiple files | EntityDBInternal duplicated (M1) |

---

```
/* ═══════════════════════════════════════════
   DRY / PATTERNS AUDIT — chunking-upload scope — 2026-03-27T14:30Z
   🔴 High (config mismatch): 1
   🟡 Medium (duplication / maintenance risk): 4
   🔵 Low (abstraction opportunities): 6
   (+ scope notes: next.config clean; types layering OK)
   Suggested extractions: lib/entitydb-idb.ts (or extend entitydb-persist),
     shared buildMinimalOCRResult, lib/chunking.ts + wire to persist,
     UploadDropzone subcomponents, ROUTES/API constants, align MAX_FILE_SIZE
   ═══════════════════════════════════════════ */
```
