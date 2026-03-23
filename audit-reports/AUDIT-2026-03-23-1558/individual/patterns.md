# Patterns & Abstraction Audit — Chunking Pipeline + Upload Wiring

Scope: `lib/chunking.ts`, `components/upload-form.tsx`, `app/api/documents/extract/route.ts`, `app/api/documents/upload/route.ts`, `app/api/upload/route.ts`, `lib/entitydb.ts`, `lib/constants.ts`, `lib/documents/errors.ts`, `lib/documents/validation.ts`, `lib/documents/provider.ts`, `lib/documents/normalize.ts`, `lib/documents/fieldCandidates.ts`, `lib/documents/index.ts`, `types/index.ts`, `types/CanonicalDocument.ts`

Role: Patterns & Abstraction Auditor (per `.cursor/commands/audit-dry.md`). Severity: 🟡 Medium = active duplication / maintenance risk; 🔵 Low = abstraction opportunity.

---

```
// 🟡 [DRY] Parallel upload validation: app/api/documents/upload/route.ts re-parses FormData,
//    checks missing file, size, and MIME inline using MAX_FILE_SIZE_BYTES / ALLOWED_MIME_TYPES,
//    while lib/documents/validation.ts parseAndValidateFiles already encodes the same rules
//    (plus multi-file). Error responses are ad-hoc { error: string } vs lib/documents/errors.ts.
//    Consolidate: route delegates to parseAndValidateFiles (single-file path) + shared errorResponse helpers,
//    or remove / deprecate upload route if /api/documents/extract is canonical.
```

```
// 🟡 [DRY] Triplicated user-facing validation copy: "Allowed: PDF, JPEG, PNG, WebP" and max-MB wording
//    appear in lib/documents/validation.ts (error.message), lib/documents/errors.ts (invalidFileTypeError,
//    fileTooLargeError), and app/api/documents/upload/route.ts (inline JSON errors). Changing policy
//    requires three edits. Consolidate: one exported helper e.g. formatAllowedTypesSummary() and
//    formatMaxSizeMb(maxBytes) consumed by validation + errors + any legacy routes.
```

```
// 🟡 [DRY] Client/server limits and allowlists diverge: components/upload-form.tsx uses
//    maxSize: 10 * 1024 * 1024 and a broad react-dropzone accept (DOC, DOCX, TXT, image/*, HEIC),
//    while lib/constants.ts defines MAX_FILE_SIZE_BYTES (4.5 MB) and ALLOWED_MIME_TYPES (PDF + three images).
//    Same conceptual rules duplicated; UI invites files the API rejects. Consolidate: import
//    MAX_FILE_SIZE_BYTES (and a shared MIME→extensions map derived from ALLOWED_MIME_TYPES) into the client,
//    or expose a tiny /api/upload-limits JSON if you must avoid bundling constants.
```

```
// 🟡 [DRY] Two document POST pipelines: app/api/documents/extract/route.ts (normalizeOCRResult,
//    fieldCandidates, ExtractionResponse) vs app/api/documents/upload/route.ts (placeholder OCR,
//    different JSON shape: docId at top level, no fieldCandidates). Duplicate generateDocumentId +
//    validation mental model. Pick one public contract or implement upload as thin wrapper calling shared service.
```

```
// 🔵 [DRY] lib/chunking.ts: "emit current buffer, compute overlap, seed next buffer" repeats in
//    fallbackChunkFullText (paragraph and sentence branches) and chunkOCRResult (block loop).
//    Extract as: e.g. flushBufferWithOverlap(chunks, buffer, nextSegment) in lib/chunking.ts
//    or lib/chunking/buffer.ts to remove copy-paste and keep CHUNK_OVERLAP behavior in one place.
```

```
// 🔵 [DRY] lib/chunking.ts: buffer growth pattern buffer ? buffer + " " + piece : piece appears
//    multiple times. Small local helper appendSegment(buffer, piece) reduces noise and mistakes.
```

```
// 🔵 [DRY] Custom hook opportunity: components/upload-form.tsx — useState (file, sourceLang, targetLang,
//    isSubmitting), handleSubmit (fetch /api/documents/extract, build CanonicalDocument, getEntityDB,
//    insertChunk loop, router.push) is a cohesive unit. Extract: hooks/useDocumentExtractionFlow.ts
//    returning { file, setFile, sourceLang, targetLang, ..., submit, isSubmitting }.
```

```
// 🔵 [DRY] Component extraction: components/upload-form.tsx — mobile and desktop branches duplicate
//    dropzone structure (getRootProps, isDragActive styling overlap), file preview row (icon, name, KB, remove),
//    and submit button pattern. Extract: components/FileDropzonePreview.tsx (props: variant, file, onRemove)
//    and optional shared TranslationDirection already partially done — extend with shared inner dropzone body.
```

```
// 🔵 [DRY] lib/documents/fieldCandidates.ts: five blocks push FieldCandidate objects with the same
//    id/documentId/blockId/confidence scaffolding. Extract: e.g. addCandidate(candidates, base, overrides)
//    or a tiny builder to avoid repeating generateCandidateId() + spread fields.
```

```
// 🔵 [DRY] ID generation: lib/documents/normalize.ts (generateBlockId → block_${uuid})
//    and lib/documents/fieldCandidates.ts (generateCandidateId → field_${uuid}) mirror the same pattern.
//    Consolidate: lib/ids.ts with makeId(prefix: 'block' | 'field') or reuse one uuid helper.
```

```
// 🔵 [DRY] app/api/documents/extract/route.ts: switch (error.type) with seven cases mirrors
//    ValidationError discriminated union. Replace with Record<ValidationError['type'], () => NextResponse>
//    or a small map to handler functions to avoid another switch when a new error type is added.
```

```
// 🔵 [DRY] components/upload-form.tsx: LANGUAGES and TARGET_LANGUAGES (filter !== "auto") are static UI data.
//    If translation settings appear elsewhere, move to lib/languages.ts or lib/constants.ts next to other UX config.
```

```
// 🔵 [DRY] app/api/upload/route.ts is a stub returning { success: true }; app/api/documents/* holds real logic.
//    Consolidate route namespace (remove stub, or implement via shared handler) to reduce duplicate "upload" concepts.
```

```
// 🔵 [DRY] lib/entitydb.ts: queryChunks maps EntityDB rows with an inline structural type annotation.
//    If similar mapping repeats as you add query variants, extract a normalizeChunkHit(r) helper.
//    (Single occurrence today — low priority.)
```

---

## Positive notes

- `lib/documents/index.ts` cleanly re-exports pipeline modules; `types/CanonicalDocument.ts` reuses `Document`, `OCRResult`, etc. from `types/index.ts` without redefining shapes.
- `lib/documents/errors.ts` centralizes `ExtractionErrorResponse` construction for the extract route; extending that pattern to other routes would complete the picture.

---

```
/* ═══════════════════════════════════════════
   DRY / PATTERNS AUDIT — scope (15 files) 2026-03-23
   🟡 Duplication Issues: 4  🔵 Abstraction Opportunities: 9
   Suggested extractions: hooks/useDocumentExtractionFlow, lib/chunking buffer helpers,
   lib/ids or makeId, fieldCandidates builder, shared validation copy + client limits from constants,
   FileDropzonePreview component, extract route error dispatch map
   ═══════════════════════════════════════════ */
```
