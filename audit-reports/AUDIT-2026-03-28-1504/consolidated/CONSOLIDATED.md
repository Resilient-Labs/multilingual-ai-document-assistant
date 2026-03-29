# Consolidated Audit Report

**Date:** 2026-03-28 · **Branch:** `feature/team-3-Post-Upload-Chunking-&-Embedding-into-EntityDB`
**Roles completed:** Principal Engineer · Security · DevOps · Accessibility
**Model tiers:** Principal=default · Security=default · DevOps=fast · A11y=fast

---

## Executive Summary

| Role | 🔴 High | 🟡 Medium | 🔵 Low | Status |
|---|:---:|:---:|:---:|:---:|
| Principal Engineer | 7 | 13 | 5 | 🔴 Critical |
| Security Auditor | 3 | 4 | 4 | 🔴 Critical |
| DevOps Engineer | 6 | 10 | 8 | 🔴 Critical |
| Accessibility Auditor | 2 | 12 | 6 | 🟡 Warn |
| Patterns Auditor | — | — | — | ⏹ Cancelled |
| **TOTAL** | **18** | **39** | **23** | **🔴 Critical** |

---

## Top 5 Action Items

### 🔴 1 · Add Authentication to All API Routes
**Affects:** Security HIGH-1 · DevOps HIGH-6

All 8 API routes are completely unauthenticated. Any internet client can proxy requests through your server to consume paid DeepL, Deepgram, Replicate, and OpenRouter API credits at your cost.

**Files:** All routes under `app/api/`  
**Fix:** Add auth middleware globally via `middleware.ts` matcher (NextAuth.js session, API key header, or CSRF token).

---

### 🔴 2 · Extend Rate Limiting to All Endpoints and Fix the In-Memory Store
**Affects:** Security HIGH-2 · Principal H-2 · DevOps HIGH-1

The middleware rate limiter covers only `/api/documents/extract` and `/api/documents/upload` — 2 of 8 endpoints. The store uses a plain `Map` on `globalThis` which resets on every cold start, and the client IP is read from the spoofable `X-Forwarded-For` header.

**File:** `middleware.ts` (lines 12–22, 87–89)  
**Fix:** Extend matcher to `/api/*`. Replace in-memory Map with Upstash Redis or Vercel KV. Use `request.ip` for client identification.

---

### 🔴 3 · Add Input Length Validation on All Text-Processing Endpoints
**Affects:** Security HIGH-3

`/api/translate`, `/api/summarize`, `/api/ask`, and `/api/safety` accept arbitrary-length text bodies with no upper bound. An attacker can send multi-megabyte payloads to amplify costs on DeepL (billed per character) and OpenRouter (billed per token).

**Files:** `app/api/translate/route.ts` · `app/api/summarize/route.ts` · `app/api/ask/route.ts` · `app/api/safety/route.ts`  
**Fix:** Enforce per-route character caps (e.g. 10,000 for translate, 50,000 for safety).

---

### 🔴 4 · Remove Double-Chunking into EntityDB
**Affects:** Principal H-5

> **Note:** This bug was *introduced* by the current branch (`ad8463d`), not pre-existing.

`persistOCRToEntityDB()` already calls `chunkText()` and `insertChunk()` for every chunk. The current branch then added an identical fire-and-forget IIFE in `useDocumentUpload.ts` (lines 129–138) that repeats the exact same process. Every chunk is stored twice, doubling IndexedDB storage and polluting RAG/semantic search with duplicates.

**Files:** `hooks/useDocumentUpload.ts` (lines 129–138) · `lib/entitydb-persist.ts` (lines 136–142)  
**Fix:** Remove the redundant chunking block in `useDocumentUpload.ts`.

---

### 🔴 5 · Fix Synchronous File I/O and Hardcoded Request ID in Logging
**Affects:** Principal H-3 · Principal H-4 · Security MED-4 · DevOps HIGH-2

`app/actions/logging.ts` has three compounding problems:
1. Uses `fs.mkdirSync`, `fs.readFileSync`, `fs.writeFileSync`, `fs.existsSync` — all block the Node.js event loop
2. Every log entry receives the same hardcoded UUID (`9f3c1a52-8a3b-4c28-b1b4-8e7d2e12f9aa`), making request correlation impossible
3. Writes to local disk which fails silently on Vercel/serverless ephemeral filesystems

**File:** `app/actions/logging.ts` (lines 34–61)  
**Fix:** Replace `fs.*Sync` with `fs.promises.*`. Use `crypto.randomUUID()` per call. Migrate to structured stdout or a logging service.

---

## Principal Engineer Audit

### 🔴 High Severity (7)

#### H-1 · God Component: `TranslatePage` (491 lines, 13 state variables)
**File:** `app/translate/[id]/page.tsx`

This component owns session recovery, translation API orchestration, TTS audio generation, voice-filter dialog UI, audio playback lifecycle, and full page layout simultaneously. With 13 `useState` calls and 4 `useEffect` hooks it far exceeds the 300-line threshold. Impossible to test in isolation.

**Fix:** Extract `useTranslation(session)` hook, `useReadAloud(translatedText, targetLang)` hook, and a `<VoiceFilterDialog>` component.

---

#### H-2 · In-Memory Rate Limiting Is Non-Functional in Serverless
**File:** `middleware.ts` (lines 12–22)

The rate-limit store uses `globalThis.__documentExtractionRateLimit` — a plain `Map` that resets on every cold start. In Vercel or any edge/serverless deployment, rate limiting is silently non-functional.

**Fix:** Replace with Upstash Redis, Vercel KV, or document that this only works in persistent-process deployments.

---

#### H-3 · Hardcoded `requestId` Makes Logging Useless
**File:** `app/actions/logging.ts` (line 53)

Every log entry gets `requestId: '9f3c1a52-8a3b-4c28-b1b4-8e7d2e12f9aa'`. Incident investigation cannot trace or correlate individual requests.

**Fix:** `requestId: crypto.randomUUID()`

---

#### H-4 · Synchronous File I/O Blocks the Event Loop
**File:** `app/actions/logging.ts` (lines 34–61)

`fs.mkdirSync`, `fs.readFileSync`, `fs.writeFileSync`, `fs.existsSync` inside an `async` function. Under concurrent load all requests serialize through these blocking calls.

**Fix:** Replace all `fs.*Sync` with `fs.promises.*` equivalents.

---

#### H-5 · Double Chunking — Every Chunk Stored Twice in EntityDB
**Files:** `hooks/useDocumentUpload.ts` (lines 129–138) · `lib/entitydb-persist.ts` (lines 136–142)

`persistOCRToEntityDB()` and the fire-and-forget IIFE in `useDocumentUpload.ts` both chunk and insert the same text. Every chunk is stored twice, polluting RAG/semantic search with duplicate results.

**Fix:** Remove the redundant chunking block in `useDocumentUpload.ts` — `persistOCRToEntityDB` already handles it.

---

#### H-6 · Environment Variables Not Validated at Startup
**Files:** `app/api/translate/route.ts` · `app/api/safety/route.ts` · `lib/tts/providers/deepgram.ts` · `lib/tts/providers/minimax-replicate.ts` · `lib/tts/providers/xtts-replicate.ts`

All API keys are read lazily on first request. Misconfigured deployments silently accept traffic then fail on the first real user action.

**Fix:** Create `lib/env.ts` that validates all required vars at import time (or use `@t3-oss/env-nextjs`).

---

#### H-7 · Triplicated Language Lists Will Drift
**Files:** `app/translate/[id]/page.tsx` (LANGUAGE_LABELS) · `components/shared/LanguageSelector.tsx` (LANGUAGES) · `app/api/translate/route.ts` (DEEPL_LANG_MAP)

Three separate hand-maintained definitions of the same language set. Any addition in one place but not the others causes silent failures — the UI shows a language the backend rejects.

**Fix:** Single `lib/languages.ts` exporting the canonical list; derive all three from it.

---

### 🟡 Medium Severity (13)

| ID | Finding | File |
|---|---|---|
| M-1 | Root `page.tsx` marked `"use client"` unnecessarily — full page excluded from RSC | `app/page.tsx` |
| M-2 | `EntityDBInternal` interface duplicated across two files, accessing undocumented internals | `lib/entitydb-persist.ts` · `hooks/useDocumentSession.ts` |
| M-3 | `getOutputUrl()` and `resolveModelRef()` copy-pasted verbatim across both TTS providers | `lib/tts/providers/minimax-replicate.ts` · `xtts-replicate.ts` |
| M-4 | Stub routes return `200 OK` with hardcoded fake data — masks unimplemented features | `app/api/upload/route.ts` · `app/api/summarize/route.ts` · `app/api/ask/route.ts` |
| M-5 | `useSafetyAnalysis` useEffect depends on object reference — re-fires on every render | `hooks/useSafetyAnalysis.ts` (line 82) |
| M-6 | Fully commented-out `extractFirstAssistantText` function — dead code | `app/api/safety/route.ts` (lines 135–149) |
| M-7 | No `error.tsx` in any route segment — unbranded crash page, no recovery | `app/` directory |
| M-8 | `useIsMobile` causes visible layout flash on mobile hydration | `hooks/use-mobile.ts` |
| M-9 | `DetectTab` directly reads sessionStorage keys — tightly coupled to storage schema | `components/features/detect/DetectTab.tsx` |
| M-10 | Images OCR'd client-side (Tesseract) while documents go server-side — inconsistent pipeline | `hooks/useDocumentUpload.ts` |
| M-11 | Multi-file uploads processed sequentially in `for...of` loop instead of `Promise.allSettled` | `app/api/documents/extract/route.ts` (lines 75–89) |
| M-12 | `suppressHydrationWarning` on root `<body>` masks legitimate hydration bugs globally | `app/layout.tsx` (line 30) |
| M-13 | Fire-and-forget chunking errors only logged to console — user never knows Q&A is broken | `hooks/useDocumentUpload.ts` (lines 129–138) |

---

### 🔵 Low Severity (5)

1. Magic numbers in `lib/chunking.ts` (500, 100, /4) should be named constants in `lib/constants.ts`
2. Dashboard page contains extensive placeholder strings ("Left top", "Place Holder Header")
3. Deprecated upload wrapper `app/api/documents/upload/route.ts` should be tracked for removal before 2026-06-27 sunset
4. TTS providers load entire audio responses into memory — use streaming for production
5. Missing `loading.tsx` files for route segments with async data fetching

---

## Security Audit (OWASP Top 10)

### 🔴 High Severity (3)

#### HIGH-1 · All API Routes Unauthenticated (OWASP A01)
**Files:** All 7 routes under `app/api/`

Zero authentication or authorization on any API route. No session checks, no API key validation, no middleware auth guard. Any internet-facing client can call these endpoints to consume paid third-party APIs.

**Fix:** Add authentication middleware applied globally via `middleware.ts` matcher.

---

#### HIGH-2 · Rate Limiting Covers Only 2 of 8 Endpoints (OWASP A04)
**File:** `middleware.ts` (lines 87–89)

`/api/translate`, `/api/tts`, `/api/safety`, `/api/ask`, `/api/summarize` have zero rate limiting despite calling paid APIs. An attacker can send thousands of requests amplifying costs on DeepL, Deepgram, and Replicate.

**Fix:** Extend the middleware matcher to cover all `/api/*` routes.

---

#### HIGH-3 · No Input Length Validation on Text-Processing Endpoints (OWASP A04)
**Files:** `app/api/translate/route.ts` · `app/api/summarize/route.ts` · `app/api/ask/route.ts` · `app/api/safety/route.ts`

The TTS route correctly enforces `MAX_TTS_TEXT_LENGTH = 8000`, but the other routes accept arbitrary-length text with no upper bound — enabling cost amplification and potential memory exhaustion.

**Fix:** Add explicit max-length validation per route (e.g. 10,000 chars for translate, 50,000 for safety).

---

### 🟡 Medium Severity (4)

#### MED-1 · Upstream Error Details Leaked to Client (OWASP A05)
**File:** `app/api/safety/route.ts` (lines 271–280)

When the OpenRouter API returns an error, the raw upstream message is forwarded to the client via the `detail` field. This can expose internal architecture details, model names, and rate-limit information.

**Fix:** Log the upstream message server-side only. Return a generic error message to the client.

---

#### MED-2 · Rate Limiter Trusts Spoofable X-Forwarded-For Header (OWASP A01)
**File:** `middleware.ts` (lines 24–31)

Any client can set `X-Forwarded-For` to rotate their apparent IP on each request and bypass rate limits entirely — each spoofed IP gets its own fresh window.

**Fix:** Use Vercel's `request.ip` property or platform-verified client IP.

---

#### MED-3 · In-Memory Rate Limiter Fails in Serverless Deployments (OWASP A04)
**File:** `middleware.ts` (lines 12–22)

Rate limit state stored in a `globalThis` Map is not shared across serverless instances. Each function invocation can run in a separate isolate with a fresh counter.

**Fix:** Use a distributed rate limiter (e.g. Upstash Redis with `@upstash/ratelimit`).

---

#### MED-4 · Server Action Writes to Disk Without Input Validation (OWASP A04/A03)
**File:** `app/actions/logging.ts` (lines 26–66)

`sourceLang` and `targetLang` strings from the client are written to `logs/logs.json` with no length validation, no log rotation, and no authentication. A script calling this in a loop can exhaust disk space.

**Fix:** Validate and cap input strings. Add log rotation. Rate-limit the action.

---

### 🔵 Hardening Recommendations (4)

| ID | Finding | Fix |
|---|---|---|
| HARD-1 | No HTTP security headers (CSP, HSTS, X-Frame-Options, Referrer-Policy) | Add `headers()` function to `next.config.js` |
| HARD-2 | No explicit request body size limit configured | Set `bodyParser` limits per route or globally |
| HARD-3 | `console.error` may log sensitive document content or raw API response bodies | Use structured logging with explicit field selection |
| HARD-4 | `dangerouslySetInnerHTML` in `components/ui/chart.tsx` (low risk — dev-controlled data only) | No action needed unless chart config becomes user-configurable |

**Verified Secure:** No committed secrets · No `NEXT_PUBLIC_` secrets · No command injection · File upload type/size validation present · TTS text length capped at 8,000 chars · No stack traces exposed to client · `path.join` used for all file paths

---

## DevOps Audit

### 🔴 High Severity (6)

| # | Finding | File |
|---|---|---|
| 1 | In-memory rate limiting resets on cold start — non-functional in serverless | `middleware.ts` |
| 2 | `logDocumentSubmission` writes to local filesystem — silently fails on Vercel ephemeral FS | `app/actions/logging.ts` |
| 3 | All outbound `fetch` calls (DeepL, OpenRouter, Deepgram, Replicate) have no timeout or AbortSignal — hang indefinitely | TTS providers · translate/safety routes |
| 4 | `/api/documents/extract` outer `catch` swallows the exception without logging — production failures are invisible | `app/api/documents/extract/route.ts` |
| 5 | No health/readiness endpoint — load balancers and synthetic monitors cannot probe the app | Missing entirely |
| 6 | Most billable API routes have no rate limiting — unbounded cost and abuse exposure | `/api/translate` · `/api/tts` · `/api/safety` |

---

### 🟡 Medium Severity (10)

| # | Finding | File |
|---|---|---|
| 1 | No startup env var validation — misconfiguration only discovered on first failing request | Multiple routes |
| 2 | Two overlapping CI workflows (`.yml` and `.yaml`) with different commands and triggers | `.github/workflows/` |
| 3 | `.env.local.example` missing `OPEN_ROUTER_API_TOKEN` and other documented variables | `.env.local.example` |
| 4 | DeepL URL hardcoded to free-tier endpoint — breaks silently for Pro subscribers | `app/api/translate/route.ts` |
| 5 | Safety route forwards raw upstream error text to clients on provider failure | `app/api/safety/route.ts` |
| 6 | No Dockerfile — non-root user, pinned base image, migration separation all unverifiable | Missing entirely |
| 7 | OCR, PDF parsing, and TTS run synchronously in request handlers without queues or backpressure | `lib/documents/provider.ts` · TTS providers |
| 8 | `/api/upload` returns `{ success: true }` with a TODO — misleads clients and monitors | `app/api/upload/route.ts` |
| 9 | No exponential backoff retries for transient 5xx/429 from upstream providers | `lib/tts/router.ts` |
| 10 | OCR failure path may surface raw error content including filenames | `app/api/documents/extract/route.ts` |

---

### 🔵 Low Severity (8)

1. `next.config.js` does not set any security headers — defaults depend entirely on the hosting platform
2. Logging is unstructured `console.error`/`console.warn` across API and TTS code — no consistent JSON shape or correlation ID
3. `logDocumentSubmission` uses a hardcoded `requestId` — hinders distributed tracing
4. No `instrumentation.ts` or OpenTelemetry hooks for tracing/metrics integration
5. No explicit `SIGTERM`/graceful shutdown handlers — reliance on Next.js/Node defaults
6. No `images.remotePatterns` policy documented for future remote assets
7. Middleware runs an O(n) sweep over the rate-limit map on every limited POST at large IP cardinality
8. Logging failures on the client path are silently discarded via `.catch(() => {})`

---

## Accessibility Audit (WCAG 2.1 AA)

### 🔴 High Severity — WCAG Violations (2)

#### A11Y-1 · Keyboard Users Cannot Activate the File Picker (WCAG 2.1.1 — Level A)
**File:** `components/upload-form.tsx`

The "Browse files" / "Take photo" buttons are nested inside the `react-dropzone` root (`getRootProps()`). When keyboard focus is on the inner `<Button>`, pressing Enter/Space triggers the button's click handler — which has no connection to the hidden file input. The file picker never opens for keyboard-only users.

**Fix:** Use `useDropzone({ noClick: true })` on the root and add `onClick={() => open()}` to the visible button. Or wrap the button in a `<label htmlFor={inputId}>` linked to the hidden input.

---

#### A11Y-2 · Submit Button Loses Its Accessible Name During Upload (WCAG 2.4.6 / 4.1.3 — Level AA)
**File:** `components/upload-form.tsx`

When `isSubmitting` is `true`, the button renders only `<Spinner />` with no visible text. Screen readers may announce nothing meaningful and sighted users lose the OCR progress string.

**Fix:** Keep visible progress text alongside the spinner. Add `aria-busy="true"` on the button and an `aria-live="polite"` span for `ocrProgress`.

---

### 🟡 Medium Severity (12)

| # | WCAG | Finding | Fix |
|---|---|---|---|
| 3 | 2.4.1 (A) | No skip-to-content link in any view | Add `<a href="#main-content">Skip to main content</a>` as first focusable element in root layout |
| 4 | 2.4.2 (A) | Page titles are static across all views — translate and dashboard have no `generateMetadata` | Add `generateMetadata` or `metadata` exports per route |
| 5 | 1.3.1 (A) | `app/document/[id]/page.tsx` has no `<main>` landmark | Wrap primary content in `<main>` |
| 6 | 1.3.1 (A) | Dashboard headings are `<span>` and plain text, not semantic heading elements | Replace with `<h1>` / `<h2>` elements |
| 7 | 1.3.1 (A) | Detect tab section labels are `<div className="text-lg font-semibold">` | Replace with `<h2>` or `<h3>` |
| 8 | 1.1.1 (A) | Lucide icons in `DetectTab` and `TranslatePage` rendered without `aria-hidden="true"` | Add `aria-hidden="true"` to decorative icons |
| 9 | 4.1.3 (AA) | Upload error `role="alert"` live region always renders even when `error` is null | Only render or activate live region when `error` is non-null |
| 10 | 4.1.3 (AA) | Translation and TTS loading spinners have no `aria-live` region for phase changes | Add `role="status"` / `aria-live="polite"` element updated with loading phase text |
| 11 | 3.3.2 (A) | `ExtractedDataPanel` required fields have no `required` attribute or visible indicator until submit | Add `required` / `aria-required="true"` and visible "(required)" in label |
| 12 | 1.3.1 (A) | Home page desktop layout has no `<main>` landmark | Wrap primary upload workflow in `<main>` |
| 13 | 4.1.3 (AA) | `<Toaster />` (Sonner) not mounted in `app/layout.tsx` — toast live regions never rendered | Import and mount `<Toaster />` in root layout |
| 14 | 1.3.1 (A) | "Translation direction" label in `LanguageSelector` is a `<p>` not programmatically linked to the selects | Use `<fieldset>` + `<legend>` or `aria-labelledby` on the select triggers |

---

### 🔵 Low Severity (6)

| # | WCAG | Finding |
|---|---|---|
| 15 | 3.1.1 | Root `<html lang="en">` is static — translated content in another language has no `lang` attribute |
| 16 | 1.1.1 | `<Progress>` in `ExtractedDataPanel` may be missing `aria-valuenow`/`aria-valuemin`/`aria-valuemax` |
| 17 | 1.1.1 | Lone `ExternalLinkIcon` in `ItemActions` has no text alternative |
| 18 | — | Download link uses generic filename `"translated-audio"` instead of a document-derived name |
| 19 | 1.4.1 | Read-along active word uses background + color + underline (good) — optionally add `aria-current="true"` |
| 20 | — | Radix dialog/tabs/select primitives provide ARIA roles by default — verify after dependency upgrades |

**Positive patterns already in place:** `next/image` has meaningful `alt` · `LanguageSelector` swap control has `aria-label` · `ExtractedDataPanel` uses `Label` + `htmlFor`, `aria-invalid`, `aria-describedby`, `aria-live` · Remove-file control has `aria-label` · Buttons use visible `focus-visible` ring styles · `Spinner` exposes `role="status"`

---

## Files Needing Immediate Attention

| Priority | File | Issues |
|:---:|---|---|
| 🔴 | `middleware.ts` | In-memory rate limit, spoofable IP, only 2/8 endpoints covered |
| 🔴 | `app/actions/logging.ts` | Sync I/O blocks event loop, hardcoded UUID, local disk write, no input validation |
| 🔴 | `hooks/useDocumentUpload.ts` | Double chunking introduced by current branch, fire-and-forget swallows failures |
| 🔴 | `app/api/translate/route.ts` | No auth, no rate limit, no input length cap, hardcoded free-tier DeepL URL |
| 🔴 | `app/api/safety/route.ts` | No auth, no rate limit, no input cap, upstream error leak, dead code |
| 🔴 | `app/api/tts/route.ts` | No auth, no rate limit, no timeout on outbound calls |
| 🟡 | `app/translate/[id]/page.tsx` | God component (491 lines), triplicated language list |
| 🟡 | `app/layout.tsx` | No skip link, static page title, Toaster not mounted, suppressHydrationWarning too broad |
| 🟡 | `components/upload-form.tsx` | Keyboard trap on file picker, submit button loses accessible name during upload |
| 🟡 | `app/api/documents/extract/route.ts` | Sequential multi-file processing, outer catch swallows exception without logging |

---

## What Was Already Addressed (feature/team-3-text-chunking-utility)

| Finding | Commit | Status |
|---|---|---|
| No rate limiting on extraction endpoints | `ce9e1ef` | Partially fixed — middleware added for 2 routes; in-memory store issue remains |
| File size constant divergence (dropzone 10MB vs server 4.5MB) | `febf8c4` | Fixed |
| Chunking utility orphaned at wrong path, RAG pipeline unwired | `aca812b` | Fixed — moved to `lib/chunking.ts`, wired `entitydb-persist.ts` |

> The double-chunking bug (H-5) was **not pre-existing** — it was introduced by the current branch in commit `ad8463d` ("Insert fire-and-forget chunking block").

---

## Recent Debug Fixes (Current Branch)

| Debug Item | Status | Evidence |
|---|---|---|
| #3 · No timeout / AbortSignal on outbound fetch calls | Fixed | Added `AbortSignal.timeout()` to every outbound `fetch` and `replicate.run()` call. Timeout constants centralised in `lib/constants.ts` (`DEEPL_TIMEOUT_MS` 10 s · `OPENROUTER_TIMEOUT_MS` 30 s · `DEEPGRAM_TIMEOUT_MS` 15 s · `REPLICATE_META_TIMEOUT_MS` 10 s · `REPLICATE_RUN_TIMEOUT_MS` 90 s · `AUDIO_DOWNLOAD_TIMEOUT_MS` 30 s). API routes now catch `TimeoutError` and return HTTP 504 instead of hanging indefinitely. Files changed: `app/api/translate/route.ts`, `app/api/safety/route.ts`, `lib/tts/providers/deepgram.ts`, `lib/tts/providers/xtts-replicate.ts`, `lib/tts/providers/minimax-replicate.ts`. |
| #4 · `/api/documents/extract` outer `catch` swallowed exceptions without logging | Fixed | `app/api/documents/extract/route.ts` now logs unexpected errors in the outer `catch` before returning `internalError(...)`. |
| #5 · No health/readiness endpoint | Fixed | Added `app/api/health/route.ts` with `GET` and `HEAD`; returns `200` when ready and `503` when required configuration is missing. |

---

*Individual reports: [`principal.md`](../individual/principal.md) · [`security.md`](../individual/security.md) · [`devops.md`](../individual/devops.md) · [`a11y.md`](../individual/a11y.md)*
