# Patterns & DRY Audit

**Scope:** Commit range `09f36063760fd12014dbcb78d8d8a1e039733627..f074c1de51388f1d66743e84a7eea23bdfdc402f` — files listed below.  
**Role:** Patterns & Abstraction Auditor (`.cursor/commands/audit-dry.md`).

---

## `app/api/documents/upload/route.ts`

```
// 🔵 [DRY] Configuration: Deprecation/successor path strings echo `middleware.ts` matcher
//    and client `fetch` targets. Consolidate into: lib/constants or lib/routes.ts
//    (e.g. DOCUMENTS_EXTRACT_PATH, DEPRECATED_UPLOAD_PATH) so Sunset/Link/matcher/client stay aligned.
```

---

## `components/upload-form.tsx`

```
// 🟡 [DRY] Duplication: Translation language list (`LANGUAGES` / `TARGET_LANGUAGES`) mirrors
//    `LANGUAGE_LABELS` in app/translate/[id]/page.tsx (same codes; labels differ slightly: "Detect language" vs "Detected").
//    Consolidate into: lib/languages.ts or constants/language-options.ts exporting codes + labels + helpers
//    (e.g. options for Select vs display map for translate page).
```

```
// 🟡 [DRY] Duplication: Selected-file preview row (icon, truncated name, size in KB, remove button)
//    appears twice with only className/size tweaks (mobile ~193–208 vs desktop ~257–272).
//    Extract as: components/upload/SelectedFileRow.tsx (props: file, variant: "mobile" | "desktop", onRemove).
```

```
// 🟡 [DRY] Duplication: Client dropzone `accept` map duplicates server policy in `ALLOWED_MIME_TYPES`
//    (lib/constants.ts) used by lib/documents/validation.ts. Risk of drift (e.g. HEIC accepted in UI via image/* + extensions
//    but not listed server-side). Consolidate: derive accept object from shared MIME list + extension map, or export
//    UPLOAD_ACCEPT_RECORD from lib/constants (or lib/documents).
```

```
// 🔵 [DRY] Repeated className pattern: `isDragActive ? "border-indigo-400 bg-indigo-200" : "border-indigo-300 bg-indigo-100"`
//    (+ desktop hover). Extract as: small helper `getDropzoneSurfaceClasses({ active, interactiveHover })` in lib/utils or colocated.
```

---

## `hooks/useDocumentUpload.ts`

```
// 🟡 [DRY] Duplication / inconsistency: Document path still `fetch("/api/documents/upload")` while
//    app/api/documents/upload/route.ts is explicitly deprecated in favor of /api/documents/extract (extra hop + console warn on server).
//    Point client at canonical endpoint and centralize URL: e.g. const DOCUMENTS_EXTRACT = "/api/documents/extract"
//    in lib/routes.ts (reuse in tests/docs where applicable).
```

```
// 🟡 [DRY] Duplication: Two `persistOCRToEntityDB({ ... })` blocks (image branch vs document branch) with overlapping fields.
//    Normalize to a single object (buildPersistPayload(file, docId, ocrResult, metadata)) then one await persistOCRToEntityDB(...).
```

```
// 🔵 [DRY] Parallel Tesseract integration: `createWorker("eng", ...)` here vs `createWorker("eng")` in
//    lib/documents/provider.ts `TesseractOCRProvider`. Client vs server split is expected; still share a constant
//    TESSERACT_LANG = "eng" (and optional shared typing for recognize options) in lib/ocr/tesseract-config.ts.
```

```
// 🔵 [DRY] Fire-and-forget chunking: `Promise.resolve().then(async () => { ... })` is a distinct pattern;
//    if reused elsewhere for background work after navigation, extract useBackgroundTask or enqueuePostPersistJob.
//    (Only one site today — low priority.)
```

---

## `lib/chunking.test.ts`

✅ DRY Audit — No issues found. (Test repetition follows normal Vitest style.)

---

## `lib/chunking.ts`

```
// 🔵 [DRY] Minor duplication: Chunk objects `{ id, text, tokenCount }` built in the short-text return path
//    and in the loop. Extract private helper: function makeChunk(index: number, text: string): Chunk
//    to keep tokenCount math and id format in one place.
```

---

## `lib/documents/provider.ts`

```
// 🔵 [DRY] MIME routing: DocumentTextProvider.extractText uses a chain of if (mime === ...).
//    Optional consolidation: Map<string, (buf: ArrayBuffer) => Promise<string>> or strategy table
//    if more types are added (reduces repeated if/return shape).
```

```
// 🔵 [DRY] OCRProvider interface declares extract(fileBuffer, mimeType) but TesseractOCRProvider.extract
//    only lists fileBuffer — second parameter unused. Align signature with interface (accept `_mimeType`) for consistency
//    with CompositeOCRProvider call site (type/schema reuse, not runtime DRY).
```

---

## `lib/image-utils.ts`

✅ DRY Audit — No issues found. (Single responsibility; HEIC brand list is localized.)

---

## `middleware.ts`

```
// 🔵 [DRY] Type hygiene: local interface `Window` shadows the global DOM `Window` type in TypeScript mental model.
//    Rename to: RateLimitWindow or ClientRateWindow.
```

```
// 🔵 [DRY] Route strings `/api/documents/extract` and `/api/documents/upload` duplicated across matcher,
//    hook fetch URL, and deprecation Link header. Centralize in shared route constants (see upload route + hook findings).
```

---

## Checklist (rolled up)

| Checklist item | Status |
|----------------|--------|
| Logic repeated 2+ in same file | Partial (`upload-form` preview + dropzone classes; `useDocumentUpload` persist blocks) |
| Similar switch/if chains | Optional map in `DocumentTextProvider` |
| Same transforms in multiple places | Language labels (cross-file), MIME allowlist (client/server) |
| Identical fetch error boilerplate | N/A (single fetch site in hook) |
| Repeated className construction | Dropzone active/inactive branches |
| Hook extraction | Already using `useDocumentUpload` — good |
| JSX >30 lines repeated | File preview + dual layout branches |
| Shared validation across routes | Client accept vs `parseAndValidateFiles` |
| DB/query duplication | N/A in scope |
| Repeated auth | N/A (not in these files) |
| Date/string/array URL utils | N/A |
| Hardcoded routes | Yes — see findings |
| Types/schemas duplicated | Language display maps (`upload-form` vs translate page) |

---

/* ═══════════════════════════════════════════
   DRY / PATTERNS AUDIT — scoped files — 2026-03-30
   🟡 Duplication Issues: 5  🔵 Abstraction Opportunities: 9
   Suggested extractions: lib/languages.ts (or constants), components/upload/SelectedFileRow.tsx,
   shared DOCUMENTS_EXTRACT / route constants, persist payload normalizer in hook,
   optional makeChunk helper, optional MIME→accept builder
   ═══════════════════════════════════════════ */
