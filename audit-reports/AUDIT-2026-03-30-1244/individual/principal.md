# Principal Engineer Audit — 2026-03-30

**Commit range:** `09f36063760fd12014dbcb78d8d8a1e039733627..f074c1de51388f1d66743e84a7eea23bdfdc402f`

**Files audited:**
- `app/api/documents/upload/route.ts`
- `components/upload-form.tsx`
- `hooks/useDocumentUpload.ts`
- `lib/chunking.test.ts`
- `lib/chunking.ts`
- `lib/documents/provider.ts`
- `lib/image-utils.ts`
- `middleware.ts`

---

## Summary

| Severity | Count |
|---|---|
| 🔴 High | 3 |
| 🟡 Medium | 6 |
| 🔵 Low | 5 |

---

## 🔴 HIGH — Must fix before merge

---

### H-1 · `lib/documents/provider.ts` — MockOCRProvider shipped as the production default

```ts
// lib/documents/provider.ts  lines 193-200
export function getOCRProvider(): OCRProvider {
  if (!_provider) {
    _provider = new MockOCRProvider();  // ← always returns empty text
  }
  return _provider;
}
```

`getOCRProvider()` unconditionally falls back to `MockOCRProvider`, which returns an empty `fullText` for every extraction. There is no environment check (`NODE_ENV`, a feature flag, or a startup call to `setOCRProvider`). Any code path that calls `getOCRProvider()` without first calling `setOCRProvider(new CompositeOCRProvider())` will silently produce empty documents in production. This is a data-correctness bug, not just a code smell.

**Fix:** Either replace the fallback with `new CompositeOCRProvider()`, or guard with `if (process.env.NODE_ENV === 'test')` before returning the mock.

---

### H-2 · `middleware.ts` — In-memory rate-limit counter is ineffective in serverless / Edge Runtime

```ts
// middleware.ts  lines 3-11
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 15;
const counters = new Map<string, Window>();
```

Next.js middleware runs on the **Edge Runtime**. Module-level state (`counters`) does not persist between invocations — every cold start or new isolate begins with an empty Map. The rate limiter silently does nothing under real serverless conditions while looking correct in local dev. Additionally, the Map has no eviction/cleanup, causing a memory leak when many unique IPs are processed in a long-lived server process (e.g., `next start` in a container).

**Fix:** Replace with a durable atomic store (Redis via Upstash, Vercel KV, or a similar edge-compatible key-value store). If a local dev approximation is acceptable, document the limitation explicitly.

---

### H-3 · `hooks/useDocumentUpload.ts` — God hook: ≥7 distinct responsibilities

The `submit` function inside `useDocumentUpload` orchestrates:
1. Logging (`logDocumentSubmission`)
2. Client-side OCR engine bootstrap and execution (Tesseract)
3. HEIC image decoding (`prepareImageBytes`)
4. Server API call (`/api/documents/upload`)
5. Entity DB persistence (`persistOCRToEntityDB`)
6. Text chunking and vector insertion (`chunkText` + `insertChunk`)
7. Session storage writes and client-side navigation (`router.push`)

At 152 lines the hook is already large; more importantly it violates the Single Responsibility Principle and makes it impossible to test any one concern in isolation. A future change to the persistence layer must touch the same function that owns navigation logic.

**Fix:** Extract at minimum: `useImageOCR` (Tesseract bootstrap + recognition), `useDocumentPersistence` (entitydb + chunking), keeping `useDocumentUpload` as an orchestration shell. The server-side upload path and the client-side OCR path should be symmetric in what they delegate.

---

## 🟡 MEDIUM — Fix in this PR or file a ticket

---

### M-1 · `middleware.ts` — "unknown" IP collapses all anonymous clients into one bucket

```ts
// middleware.ts  line 15-18
req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
req.headers.get("x-real-ip") ??
"unknown"
```

When neither header is present (local dev, certain proxies, direct connections), every request maps to the IP `"unknown"`. The 15-requests-per-minute limit then applies collectively to all unidentified traffic, making legitimate users block each other. In the opposite scenario — a malicious actor who spoofs or strips these headers — there is no limit per actual connection.

**Fix:** Either reject or skip rate-limiting when the IP cannot be determined, or use a request fingerprint (e.g., a session token) as the fallback key with a stricter limit.

---

### M-2 · `lib/documents/provider.ts` — `TesseractOCRProvider` hard-codes language `"eng"` in a multilingual app

```ts
// lib/documents/provider.ts  line 53
const worker = await createWorker("eng");
```

The application is explicitly multilingual (19 supported languages in the UI), yet the server-side OCR provider forces English-only recognition. Documents in Arabic, Chinese, Japanese, Korean, Hindi, etc. will produce near-empty or garbled text. The language parameter received from the client (via `sourceLang`) is never passed through to this provider.

**Fix:** Accept an optional `language` parameter on `OCRProvider.extract` (or on the constructor), map the UI language codes to Tesseract language codes, and pass them through `CompositeOCRProvider` → `TesseractOCRProvider`.

---

### M-3 · `hooks/useDocumentUpload.ts` — `ocrProgress` set to OCR label before the image branch is evaluated; double type-cast signals a type mismatch

```ts
// line 38 — fires unconditionally, even for PDF/DOCX uploads
setOcrProgress("Loading OCR engine…");

// lines 59-63 — double cast to work around type incompatibility
const bytes = await prepareImageBytes(file, setOcrProgress);
const { data } = await worker.recognize(
  bytes as unknown as Parameters<typeof worker.recognize>[0],
  ...
```

(a) The "Loading OCR engine…" progress message displays during a plain file upload where no OCR engine loads, confusing the user.

(b) The `as unknown as X` double cast is a red flag: `prepareImageBytes` returns `Uint8Array` but `worker.recognize` expects a different type. This should be resolved at the type level (e.g., pass the original `File` or cast to the correct overload), not suppressed with a double cast.

---

### M-4 · `lib/image-utils.ts` — Browser-only APIs used with no SSR guard

```ts
// lib/image-utils.ts  lines 36-53
const canvas = document.createElement("canvas");
...
const ctx = canvas.getContext("2d")!;  // non-null assertion
```

`prepareImageBytes` calls `document.createElement` and `canvas.getContext`, both of which are undefined in Node.js and Edge Runtime. If this module is ever imported server-side (e.g., in a test runner without jsdom, or via a future server route), it will throw at module evaluation. The non-null assertion `ctx!` also risks a runtime crash if canvas 2D is unavailable.

**Fix:** Add a `typeof document === "undefined"` guard at the top of the HEIC path and throw a meaningful error. Use `as CanvasRenderingContext2D | null` and null-check `ctx`.

---

### M-5 · `components/upload-form.tsx` — `TranslationDirection` and `ErrorMessage` as inline JSX variables are a React anti-pattern

```ts
// components/upload-form.tsx  lines 102-155, 161-175
const TranslationDirection = ( <div>…</div> );
const ErrorMessage = ( <div>…</div> );
```

These are JSX expressions stored in `const` variables inside the render function, not React components. This pattern:
- Prevents hooks from ever being added inside them (Rules of Hooks would be violated)
- Makes the intent ambiguous (are these components? fragments? lazy values?)
- Re-creates the JSX tree on every render with no memoization opportunity

**Fix:** Extract into named sub-components (`<TranslationDirection />`, `<ErrorMessage />`), or at minimum wrap in `useMemo` if keeping them inline. `swapLanguages` and `removeFile` should also be wrapped in `useCallback` to avoid referential churn when passed deeper.

---

### M-6 · `lib/documents/provider.ts` — Module-level singleton breaks in serverless; fallback dimensions are magic numbers

```ts
// lines 193-200
let _provider: OCRProvider | null = null;

export function getOCRProvider(): OCRProvider { … }
export function setOCRProvider(provider: OCRProvider): void {
  _provider = provider;
}

// lines 76-81 — magic fallback
const pageWidth  = blocks.length ? Math.max(…) : 1000;
const pageHeight = blocks.length ? Math.max(…) : 1000;
```

The mutable module singleton (`_provider`) is not safe across serverless invocations (state is not guaranteed to persist). `setOCRProvider` called during bootstrap may not be reflected in subsequent cold-start isolates.

The fallback page dimensions `1000` × `1000` when no blocks are found are magic numbers with no documented basis (e.g., not standard US Letter pts). Any consumer normalizing bounding boxes against these values will silently receive wrong coordinates.

**Fix:** Replace the singleton with dependency injection (pass the provider explicitly, or use a request-scoped factory). Name the fallback dimensions as constants with comments explaining their provenance.

---

## 🔵 LOW — Optional improvements

---

### L-1 · `app/api/documents/upload/route.ts` — Response header mutation may be fragile

```ts
// lines 16-21
response.headers.set("Deprecation", "true");
```

`NextResponse` headers may be read-only depending on the Next.js version and how the inner handler constructs its response. Mutating headers after the fact is fragile. A safer pattern is to create a new `NextResponse` by cloning the response body and merging headers.

---

### L-2 · `lib/chunking.ts` — Magic number for token estimation

```ts
tokenCount: Math.ceil(trimmed.length / 4),
```

The `4` (characters-per-token approximation) appears three times (two code paths + implicit in tests). It should be extracted to a named constant: `const CHARS_PER_TOKEN = 4`. The approximation is rough but acceptable for RAG chunking; a comment acknowledging that would aid future maintainers.

---

### L-3 · `hooks/useDocumentUpload.ts` — Silent swallow of logging failure; submit not memoized

```ts
logDocumentSubmission(sourceLang, targetLang).catch(() => {});
```

An empty `.catch` silently discards any error, including network failures that might indicate a misconfigured logging endpoint. At minimum, log to `console.warn` in non-production. Additionally, the `submit` function is recreated on every render — if `useDocumentUpload` is used in a component that re-renders frequently, this causes unnecessary closures. Wrapping `submit` in `useCallback` with appropriate dependencies would be a small but correct improvement.

---

### L-4 · `components/upload-form.tsx` — Duplicated file-card UI and magic language defaults

The "file selected" card is rendered in two near-identical blocks (mobile lines 192-210, desktop lines 258-276). Extracting a `<SelectedFileCard file={file} onRemove={removeFile} />` component would remove ~20 lines of duplication.

The default values `"auto"` (source language) and `"es"` (target language) are magic strings. Defining `const DEFAULT_SOURCE_LANG = "auto"` and `const DEFAULT_TARGET_LANG = "es"` in the constants file (alongside `MAX_FILE_SIZE_BYTES`) would centralize defaults and ease A/B testing or locale-based defaulting.

---

### L-5 · `lib/documents/provider.ts` — Hardcoded `language: "en"` in `DocumentTextProvider`; `normalizeBlockBbox` has no caller context

`DocumentTextProvider.extract` unconditionally returns `language: "en"`. For documents in other languages this metadata is incorrect and may confuse downstream consumers. The `normalizeBlockBbox` utility is exported but there is no evidence it is called by any consumer in this changeset; if it is unused it should be marked `@internal` or removed.

---

## Per-file Quick Reference

| File | 🔴 | 🟡 | 🔵 |
|---|---|---|---|
| `app/api/documents/upload/route.ts` | 0 | 0 | 1 (L-1) |
| `components/upload-form.tsx` | 0 | 1 (M-5) | 1 (L-4) |
| `hooks/useDocumentUpload.ts` | 1 (H-3) | 1 (M-3) | 1 (L-3) |
| `lib/chunking.ts` | 0 | 0 | 1 (L-2) |
| `lib/chunking.test.ts` | ✅ clean | ✅ clean | ✅ clean |
| `lib/documents/provider.ts` | 1 (H-1) | 2 (M-2, M-6) | 1 (L-5) |
| `lib/image-utils.ts` | 0 | 1 (M-4) | 0 |
| `middleware.ts` | 1 (H-2) | 1 (M-1) | 0 |

---

*Generated by Principal Engineer audit role · 2026-03-30T12:44Z*
