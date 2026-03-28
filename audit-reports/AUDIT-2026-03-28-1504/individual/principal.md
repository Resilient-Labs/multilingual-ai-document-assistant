# PRINCIPAL ENGINEER AUDIT — 2026-03-28-1504
## Scope: Full Project

---

### High Severity (must fix)

#### H-1. God Component — `TranslatePage` (491 lines, 13 state variables, 5+ responsibilities)

**File:** `app/translate/[id]/page.tsx`

This component owns session recovery from `sessionStorage`, translation API orchestration, TTS audio generation, voice-filter dialog UI, audio playback lifecycle, and full page layout. With 13 `useState` calls, 4 `useEffect` hooks, and 2 async handlers, it far exceeds the God-component threshold.

**Impact:** Impossible to test in isolation, high re-render cost, and any change to one concern risks regressions in others.

**Recommendation:** Extract `useTranslation(session)` hook, `useReadAloud(translatedText, targetLang)` hook, and split the dialog into a `<VoiceFilterDialog>` component. The page should only compose these pieces.

---

#### H-2. In-Memory Rate Limiting Will Not Work in Serverless/Edge

**File:** `middleware.ts` (lines 12–22)

The rate-limit store uses `globalThis.__documentExtractionRateLimit` — a plain `Map` that resets on every cold start. In Vercel or any edge/serverless deployment, each invocation can spin up a fresh isolate, making this rate limiter nearly useless.

**Impact:** Rate limiting is silently non-functional in production. Abuse of the extraction endpoint is unmitigated.

**Recommendation:** Replace with an external store (e.g., Upstash Redis, Vercel KV) or use Vercel's built-in rate-limiting middleware. If staying on Node runtime, at minimum document that it only works in persistent-process deployments.

---

#### H-3. Hardcoded `requestId` in Logging Server Action

**File:** `app/actions/logging.ts` (line 53)

```typescript
requestId: '9f3c1a52-8a3b-4c28-b1b4-8e7d2e12f9aa',
```

Every log entry receives the same UUID. This defeats the purpose of a request identifier — it is impossible to correlate or distinguish log entries.

**Impact:** Logging/observability is broken. Incident investigation cannot trace individual requests.

**Recommendation:** Generate a new UUID per invocation: `requestId: crypto.randomUUID()`.

---

#### H-4. Synchronous File I/O in Server Action

**File:** `app/actions/logging.ts` (lines 34–61)

Uses `fs.mkdirSync`, `fs.readFileSync`, `fs.writeFileSync`, and `fs.existsSync`. These block the Node.js event loop and will cause latency spikes under concurrent load.

**Impact:** Every form submission blocks the server thread while writing to disk. Under concurrent requests, this serializes through the event loop.

**Recommendation:** Replace all `fs.*Sync` calls with their async counterparts (`fs.promises.mkdir`, `fs.promises.readFile`, `fs.promises.writeFile`). The function is already `async`.

---

#### H-5. Double Chunking — Chunks Inserted Twice into EntityDB

**File:** `hooks/useDocumentUpload.ts` (lines 129–138) and `lib/entitydb-persist.ts` (lines 136–142)

`persistOCRToEntityDB()` already calls `chunkText()` and `insertChunk()` for every chunk. Then `useDocumentUpload.ts` immediately does the exact same chunking and insertion again in a fire-and-forget IIFE. Every chunk is stored twice in EntityDB, doubling storage and polluting RAG queries with duplicate results.

**Impact:** Semantic search returns duplicate entries. IndexedDB storage is doubled. RAG answer quality degrades.

**Recommendation:** Remove the redundant chunking block in `useDocumentUpload.ts` (lines 129–138) since `persistOCRToEntityDB` already handles it.

---

#### H-6. Environment Variables Not Validated at Startup

**Files:** `app/api/translate/route.ts`, `app/api/safety/route.ts`, `lib/tts/providers/deepgram.ts`, `lib/tts/providers/minimax-replicate.ts`, `lib/tts/providers/xtts-replicate.ts`

All API keys (`DEEPL_API_KEY`, `OPEN_ROUTER_API_TOKEN`, `DEEPGRAM_API_KEY`, `REPLICATE_API_TOKEN`) are read at module scope or lazily on first request. There is no startup validation. Misconfigured environments are only discovered when a user hits the endpoint and gets a 503.

**Impact:** Production deploys with missing env vars silently accept traffic, then fail on first real request.

**Recommendation:** Create a `lib/env.ts` module that validates all required environment variables at import time and throws during build/startup if any are missing. Import it in `next.config.js` via `serverRuntimeConfig` or use a library like `@t3-oss/env-nextjs`.

---

#### H-7. Triplicated Language Lists Will Drift

**Files:**
- `app/translate/[id]/page.tsx` — `LANGUAGE_LABELS` (lines 45–65)
- `components/shared/LanguageSelector.tsx` — `LANGUAGES` (lines 15–35)
- `app/api/translate/route.ts` — `DEEPL_LANG_MAP` (lines 8–27)

Three separate hand-maintained definitions of the same supported languages. Any language addition/removal must update all three or the UI and API fall out of sync.

**Impact:** Adding a language in one place but not the others causes silent failures — UI shows a language the backend rejects, or the backend accepts a language the UI can't display.

**Recommendation:** Create a single `lib/languages.ts` that exports the canonical language list, labels, and DeepL mappings. Derive all three from the same source.

---

### Medium Severity (fix soon)

#### M-1. Root Page Is Unnecessarily a Client Component

**File:** `app/page.tsx` (line 1: `"use client"`)

The entire home page is marked `"use client"` even though the desktop layout (branding panel, static copy) is purely static. Only `<UploadForm>` requires interactivity.

**Impact:** The entire page tree is excluded from React Server Component benefits — larger JS bundle, slower initial paint, no server-side rendering of static content.

**Recommendation:** Remove `"use client"` from `page.tsx`. Keep `<UploadForm>` as a client component (it already has its own `"use client"` directive). `useIsMobile` usage can be replaced with CSS-based responsive techniques or a small client wrapper.

---

#### M-2. Fragile Cast to EntityDB Internals (Duplicated)

**Files:** `lib/entitydb-persist.ts` (lines 40–58) and `hooks/useDocumentSession.ts` (lines 26–37)

Both files define an `EntityDBInternal` interface and cast EntityDB to access its private `dbPromise` property. This is the same interface duplicated in two places, and it reaches into undocumented library internals.

**Impact:** Any EntityDB library update that renames or restructures `dbPromise` will silently break both persistence and session retrieval at runtime with no compile-time warning.

**Recommendation:** Extract the IDB access into a single `lib/entitydb-idb.ts` helper. Consider filing an issue with the EntityDB library for a public API to access the underlying store, or wrapping the entire storage layer behind an adapter.

---

#### M-3. Duplicated `getOutputUrl` and `resolveModelRef` in TTS Providers

**Files:**
- `lib/tts/providers/minimax-replicate.ts` (lines 34–57, 59–92)
- `lib/tts/providers/xtts-replicate.ts` (lines 14–37, 39–72)

`getOutputUrl()` is copy-pasted verbatim across both files. `resolveModelRef()` follows the same pattern with only the model name differing. Both use module-level `let resolvedModelRef` caching.

**Impact:** Bug fixes or enhancements to either function must be applied in both places. Divergence is inevitable.

**Recommendation:** Extract a shared `lib/tts/replicate-utils.ts` with `getOutputUrl()` and a parameterized `createModelRefResolver(modelName)` factory.

---

#### M-4. Stub API Routes Returning Success Without Implementation

**Files:**
- `app/api/upload/route.ts` — returns `{ success: true }` with a TODO comment
- `app/api/summarize/route.ts` — returns a hardcoded placeholder string
- `app/api/ask/route.ts` — returns a hardcoded placeholder string

**Impact:** Consumers calling these endpoints receive 200 OK with fake data. In integration testing or if other teams build against these contracts, the lack of real implementation is masked by successful responses.

**Recommendation:** Either implement the endpoints or return `501 Not Implemented` with a clear error message so consumers know the feature is unavailable. Track completion in a backlog.

---

#### M-5. `useSafetyAnalysis` Re-fires on Every Render Due to Object Identity

**File:** `hooks/useSafetyAnalysis.ts` (line 82: `[ocr]`)

The `useEffect` dependency is `[ocr]`, but OCR results are plain objects. If the parent component doesn't memoize the OCR reference (e.g., via `useMemo`), the effect re-triggers on every render, making a new API call each time.

**Impact:** Potential infinite re-fetch loop or excessive API calls to the safety endpoint, depending on parent rendering behavior.

**Recommendation:** Either: (a) accept a stable identifier like `ocr.documentId` as the dependency, or (b) use a ref-based comparison to skip re-execution when the content hasn't changed.

---

#### M-6. Commented-Out Dead Code in Safety Route

**File:** `app/api/safety/route.ts` (lines 135–149)

A fully commented-out `extractFirstAssistantText` function. This is dead code that adds noise and confusion.

**Impact:** Maintenance burden and ambiguity about whether this code is needed.

**Recommendation:** Remove the commented-out block. It is preserved in version control if ever needed.

---

#### M-7. No Error Boundaries for Any Route Segment

**Directories:** `app/`, `app/translate/[id]/`, `app/document/[id]/`, `app/dashboard/`

No `error.tsx` or global `error.tsx` file exists. Runtime errors (e.g., EntityDB initialization failure, missing sessionStorage) will show the default Next.js error page with no recovery path.

**Impact:** Users see an unbranded crash page with no way to recover. No error telemetry is captured.

**Recommendation:** Add `app/error.tsx` with a branded error UI and a "try again" button. Add route-specific `error.tsx` where richer recovery is possible (e.g., "go back to upload").

---

#### M-8. `useIsMobile` Causes Layout Flash on Hydration

**File:** `hooks/use-mobile.ts`

Initial state is `undefined`, coerced to `false` via `!!isMobile`. The server render always produces the desktop layout. After hydration, mobile users see a flash as the layout switches.

**Impact:** Poor UX on mobile — visible layout shift on every page load.

**Recommendation:** Use CSS-based responsive design (media queries, Tailwind breakpoints) for the layout skeleton, and only use the hook for JS-dependent behavior. Alternatively, initialize from `window.innerWidth` in a layout effect.

---

#### M-9. `DetectTab` Is Tightly Coupled to `sessionStorage` Shape

**File:** `components/features/detect/DetectTab.tsx`

This component directly reads `sessionStorage` keys (`current-doc-id`, `translate-*`) and reconstructs an OCR result from the stored translate session payload. It has intimate knowledge of the storage schema used by `useDocumentUpload`.

**Impact:** Any change to the session storage shape in the upload flow breaks the detect tab silently. Component cannot be tested without mocking `sessionStorage`. Violates separation of concerns.

**Recommendation:** Receive OCR data via props or a shared context/hook. The component should not know where the data is stored.

---

#### M-10. Inconsistent Upload Path: Client-Side OCR vs. Server-Side Extraction

**File:** `hooks/useDocumentUpload.ts` (lines 49–125)

Images are OCR'd client-side with Tesseract.js in the browser, while documents (PDF, DOC, DOCX, TXT) are sent to `/api/documents/extract` for server-side processing. This dual path means:
- Different error handling and validation logic per file type
- Client-side OCR bypasses the server's validation pipeline
- Block/bounding-box quality differs (client produces a single block with `id: "b1"`)

**Impact:** Inconsistent data quality in EntityDB depending on file type. Server-side validation (file size, MIME checks) is bypassed for images.

**Recommendation:** Unify on the server extraction path for all file types, or at minimum ensure the client-side image path goes through the same validation and normalization as the server path.

---

#### M-11. Sequential File Processing in Extraction Route

**File:** `app/api/documents/extract/route.ts` (lines 75–89)

Multi-file uploads are processed one at a time in a `for...of` loop. Each file's OCR is awaited before the next begins.

**Impact:** Multi-file extraction latency scales linearly with file count instead of leveraging parallelism.

**Recommendation:** Use `Promise.allSettled()` for parallel OCR processing, with per-file error handling.

---

#### M-12. `suppressHydrationWarning` on Root `<body>` Element

**File:** `app/layout.tsx` (line 30)

This globally suppresses hydration mismatch warnings for the entire page body. While often added for themes, it masks legitimate hydration bugs anywhere in the component tree.

**Impact:** Real hydration mismatches (e.g., from `useIsMobile` — see M-8) are silently swallowed, making debugging harder.

**Recommendation:** Scope `suppressHydrationWarning` narrowly to only the elements that genuinely need it (e.g., a theme `<script>` tag), or remove it and address the underlying hydration issues.

---

#### M-13. Fire-and-Forget Chunking Promise Silently Swallows Failures

**File:** `hooks/useDocumentUpload.ts` (lines 129–138)

```typescript
void (async () => {
  try {
    const chunks = chunkText(fullText);
    for (const chunk of chunks) {
      await insertChunk(chunk.text, { docId, chunkId: chunk.id });
    }
  } catch (err) {
    console.error("[chunking] Failed to embed chunks:", err);
  }
})();
```

Chunking errors are logged to console but never surfaced to the user. If EntityDB embedding fails, the Q&A feature is silently broken.

**Impact:** Users navigate to the translate page believing their document is ready for Q&A, but no chunks exist. No retry mechanism.

**Recommendation:** (After fixing H-5 which makes this block redundant) If any background work remains, track its status and surface failures via a toast or banner.

---

### Summary

| Severity | Count |
|----------|-------|
| 🔴 High  | 7     |
| 🟡 Medium| 13    |
| 🔵 Low   | 5     |

🔴 High: 7  🟡 Medium: 13  🔵 Low: 5

**Low-severity items (not detailed above, tracked for completeness):**
1. Magic numbers in `lib/chunking.ts` (500, 100, /4) should be named constants in `lib/constants.ts`
2. Dashboard page (`app/dashboard/page.tsx`) contains extensive placeholder strings ("Left top", "Place Holder Header")
3. Deprecated upload wrapper (`app/api/documents/upload/route.ts`) should be actively tracked for removal before the 2026-06-27 sunset date
4. TTS providers load entire audio responses into memory; acceptable at current scale but should use streaming for production
5. Missing `loading.tsx` files for route segments with async data fetching
