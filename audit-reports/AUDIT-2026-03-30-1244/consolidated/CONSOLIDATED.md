# Consolidated Audit Report

**Date:** 2026-03-30  
**Timestamp key:** 2026-03-30-1244  
**Commit range:** `09f36063760fd12014dbcb78d8d8a1e039733627..f074c1de51388f1d66743e84a7eea23bdfdc402f`  
**Scope:** 8 files changed in the above commit range

| File | Notes |
|------|-------|
| `app/api/documents/upload/route.ts` | Deprecated upload shim |
| `components/upload-form.tsx` | React upload form UI |
| `hooks/useDocumentUpload.ts` | Client upload orchestration hook |
| `lib/chunking.test.ts` | Unit tests for chunking |
| `lib/chunking.ts` | RAG text chunking logic |
| `lib/documents/provider.ts` | OCR provider abstraction & implementations |
| `lib/image-utils.ts` | Client-side HEIC image preparation |
| `middleware.ts` | Edge rate-limiter middleware |

---

## Executive Summary

| Role | 🔴 High | 🟡 Medium | 🔵 Low | Status |
|------|---------|-----------|--------|--------|
| Principal Engineer | 3 | 6 | 5 | 🔴 **Critical** |
| Security Auditor | 2 | 4 | 3 | 🔴 **Critical** |
| DevOps Engineer | 1 | 9 | 7 | 🟡 **Warn** |
| Accessibility Auditor | 1 | 3 | 2 | 🟡 **Warn** |
| Patterns Auditor | 0 | 5 | 9 | 🟡 **Warn** |
| **Total** | **7** | **27** | **26** | 🔴 **Critical** |

---

## Top 5 Action Items (must fix before merge or next release)

### 1. 🔴 `lib/documents/provider.ts` — MockOCRProvider is the production default
**[Principal H-1 / Security M-4 / DevOps H-1]** `getOCRProvider()` unconditionally falls back to `MockOCRProvider`, which returns empty text for every extraction. There is no `setOCRProvider()` call anywhere in production code — only in tests. Every document upload in production silently produces empty OCR output.  
**Fix:** Change the default fallback to `new CompositeOCRProvider()`, or throw a configuration error if no provider has been set; restrict `MockOCRProvider` to test environments only (`NODE_ENV === 'test'`).

---

### 2. 🔴 `middleware.ts` — No authentication on upload/extract routes
**[Security H-2]** Neither `/api/documents/upload` nor `/api/documents/extract` checks user identity. Any unauthenticated request from the public internet can submit arbitrary files and trigger OCR processing, exhausting compute/API quotas.  
**Fix:** Add a session check at the top of the POST handler (e.g., `getServerSession(authOptions)`) and return 401 for unauthenticated requests.

---

### 3. 🔴 `middleware.ts` — IP spoofing bypasses rate limiter; in-memory counter broken in serverless
**[Security H-1 / Principal H-2 / DevOps M-1]** `x-forwarded-for` is fully attacker-controlled and trusted without proxy validation. The rate limit Map is module-level in-memory state — each serverless cold start resets it to zero, making the limit silently ineffective in production. The Map also has no eviction strategy (memory leak).  
**Fix:** Use the platform-set `req.ip` (Vercel) or validate proxy depth. Replace the Map with a distributed atomic counter (Redis via Upstash, Vercel KV, or `@upstash/ratelimit`).

---

### 4. 🔴 `hooks/useDocumentUpload.ts` — God hook: ≥7 responsibilities, fire-and-forget embedding
**[Principal H-3 / DevOps M-3]** `useDocumentUpload.submit` orchestrates logging, client OCR bootstrapping, HEIC decoding, server upload, entity DB persistence, text chunking/vector insertion, session storage, and navigation — all in one 152-line function. Chunking and embedding are fire-and-forget: failures only surface as `console.error` after the user has already navigated away, leaving documents silently non-queryable for RAG.  
**Fix:** Extract `useImageOCR` and `useDocumentPersistence` sub-hooks. Await or queue the chunking/embedding step with a retry/notification mechanism.

---

### 5. 🟡 `lib/documents/provider.ts` — Tesseract hard-codes `"eng"` in a multilingual app
**[Principal M-2 / Patterns 🔵]** `TesseractOCRProvider` always creates `createWorker("eng")`. The application supports 19 languages, but Arabic, Chinese, Japanese, Korean, Hindi, etc. will produce near-empty or garbled OCR output. The `sourceLang` from the client is never forwarded to the server OCR provider.  
**Fix:** Add an optional `language` parameter to `OCRProvider.extract` (or constructor), map UI language codes to Tesseract language codes, and propagate `sourceLang` through the call chain.

---

## Per-Role Findings

### Principal Engineer (`individual/principal.md`)

| ID | Severity | File | Issue |
|----|----------|------|-------|
| H-1 | 🔴 High | `lib/documents/provider.ts` | MockOCRProvider default in production |
| H-2 | 🔴 High | `middleware.ts` | In-memory rate limit ineffective in serverless/Edge |
| H-3 | 🔴 High | `hooks/useDocumentUpload.ts` | God hook (≥7 responsibilities) |
| M-1 | 🟡 Medium | `middleware.ts` | `"unknown"` IP collapses all anonymous clients |
| M-2 | 🟡 Medium | `lib/documents/provider.ts` | Hard-coded `"eng"` in multilingual app |
| M-3 | 🟡 Medium | `hooks/useDocumentUpload.ts` | OCR progress shown for non-image uploads; double type-cast |
| M-4 | 🟡 Medium | `lib/image-utils.ts` | Browser-only APIs with no SSR guard |
| M-5 | 🟡 Medium | `components/upload-form.tsx` | Inline JSX vars are an anti-pattern |
| M-6 | 🟡 Medium | `lib/documents/provider.ts` | Module singleton unsafe in serverless; magic fallback dimensions |
| L-1 | 🔵 Low | `app/api/documents/upload/route.ts` | Response header mutation may be fragile |
| L-2 | 🔵 Low | `lib/chunking.ts` | Magic number for token estimation (×3 occurrences) |
| L-3 | 🔵 Low | `hooks/useDocumentUpload.ts` | Silent logging failure; submit not memoized |
| L-4 | 🔵 Low | `components/upload-form.tsx` | Duplicated file-card JSX; magic language defaults |
| L-5 | 🔵 Low | `lib/documents/provider.ts` | Hardcoded `language: "en"` in `DocumentTextProvider` |

---

### Security Auditor (`individual/security.md`)

| ID | Severity | File | OWASP | Issue |
|----|----------|------|-------|-------|
| H-1 | 🔴 High | `middleware.ts` | A04 | IP spoofing bypasses rate limiter |
| H-2 | 🔴 High | `app/api/documents/upload/route.ts` | A01 | No authentication on upload/extract routes |
| M-1 | 🟡 Medium | `hooks/useDocumentUpload.ts` | A02 | Sensitive document text written to sessionStorage |
| M-2 | 🟡 Medium | `app/api/documents/extract/route.ts` | A05 | Raw OCR engine error messages returned to client |
| M-3 | 🟡 Medium | `middleware.ts` | A04 | In-memory rate limiter per-process; ineffective in serverless |
| M-4 | 🟡 Medium | `lib/documents/provider.ts` | A04 | MockOCRProvider is the production default |
| L-1 | 🔵 Low | `middleware.ts` | A05 | Unbounded Map; memory exhaustion under attack |
| L-2 | 🔵 Low | `components/upload-form.tsx` | A04 | File type enforcement is UI-only at the form layer |
| L-3 | 🔵 Low | `hooks/useDocumentUpload.ts` | A05 | Silent fire-and-forget failure in chunk embedding |

---

### DevOps Engineer (`individual/devops.md`)

| Severity | File | Issue |
|----------|------|-------|
| 🔴 High | `lib/documents/provider.ts` | `getOCRProvider()` defaults to MockOCRProvider; no production wiring |
| 🟡 Medium | `app/api/documents/upload/route.ts` | Deprecation logged as plain string, not structured JSON |
| 🟡 Medium | `hooks/useDocumentUpload.ts` | fetch() has no AbortSignal / timeout |
| 🟡 Medium | `hooks/useDocumentUpload.ts` | `logDocumentSubmission` failure silently dropped |
| 🟡 Medium | `hooks/useDocumentUpload.ts` | Chunking/embedding fire-and-forget; failures go unreported |
| 🟡 Medium | `hooks/useDocumentUpload.ts` | Full file buffered in memory for OCR |
| 🟡 Medium | `lib/documents/provider.ts` | Tesseract/OCR paths have no timeout; pathological files block indefinitely |
| 🟡 Medium | `lib/image-utils.ts` | HEIC path double-buffers full file in memory |
| 🟡 Medium | `middleware.ts` | In-memory rate limit broken under horizontal scaling |
| 🟡 Medium | `middleware.ts` | `"unknown"` IP collapses anonymous clients; fairness risk |
| 🔵 Low | `hooks/useDocumentUpload.ts` | No cancellation of Tesseract on component unmount |
| 🔵 Low | `lib/chunking.ts` | Token count heuristic (length/4) misaligned with billing/hard limits |
| 🔵 Low | `lib/documents/provider.ts` | Module-level singleton; expected behavior not documented |
| 🔵 Low | `lib/image-utils.ts` | No timeout for libheif decode / canvas.toBlob |
| 🔵 Low | `middleware.ts` | 429 responses not logged with structured fields |
| 🔵 Low | `middleware.ts` | MAX_REQUESTS=15 may be tight for power users |
| 🔵 Low | `app/api/documents/upload/route.ts` | No error boundary around extractHandler delegation |

---

### Accessibility Auditor (`individual/a11y.md`) — WCAG 2.1 AA

*7 files were fully clean (server/logic files). All findings are in `components/upload-form.tsx`.*

| ID | Severity | WCAG | Issue |
|----|----------|------|-------|
| — | 🔴 High | 4.1.3 Status Messages | `ocrProgress` text not announced to screen readers during long operations |
| — | 🟡 Medium | 2.4.3 Focus Order | Multiple nested tab stops in dropzone (root + inner Button) |
| — | 🟡 Medium | 1.3.1 Info and Relationships | Dropzone root has no accessible name (`aria-label`/`aria-labelledby`) |
| — | 🟡 Medium | 1.1.1 Non-text Content | `FileTextIcon` / `UploadCloudIcon` missing `aria-hidden="true"` |
| — | 🔵 Low | 1.4.3 Contrast | `text-indigo-600` on `bg-indigo-100/200` — verify ≥4.5:1 |
| — | 🔵 Low | 3.3.1 Error Identification | Hidden input not linked to error container via `aria-describedby` |

---

### Patterns Auditor (`individual/patterns.md`)

| Severity | File | Issue |
|----------|------|-------|
| 🟡 Medium | `components/upload-form.tsx` | Language list duplicates `LANGUAGE_LABELS` in translate page → `lib/languages.ts` |
| 🟡 Medium | `components/upload-form.tsx` | Selected-file preview row duplicated (mobile/desktop) → `SelectedFileRow.tsx` |
| 🟡 Medium | `components/upload-form.tsx` | Dropzone `accept` map duplicates server `ALLOWED_MIME_TYPES` — drift risk |
| 🟡 Medium | `hooks/useDocumentUpload.ts` | Client still POSTs to deprecated `/api/documents/upload` instead of `/api/documents/extract` |
| 🟡 Medium | `hooks/useDocumentUpload.ts` | Two `persistOCRToEntityDB` calls with overlapping fields → extract `buildPersistPayload()` |
| 🔵 Low | `app/api/documents/upload/route.ts` | Route path strings hardcoded → `lib/routes.ts` / `DOCUMENTS_EXTRACT_PATH` |
| 🔵 Low | `components/upload-form.tsx` | Dropzone active/inactive className repeated → `getDropzoneSurfaceClasses()` helper |
| 🔵 Low | `hooks/useDocumentUpload.ts` | Tesseract lang string duplicated between hook and provider → `TESSERACT_LANG` constant |
| 🔵 Low | `hooks/useDocumentUpload.ts` | Fire-and-forget pattern could become shared `useBackgroundTask` (low priority today) |
| 🔵 Low | `lib/chunking.ts` | Chunk object built in two paths → private `makeChunk()` helper |
| 🔵 Low | `lib/documents/provider.ts` | `DocumentTextProvider.extractText` if-chain → optional MIME strategy table |
| 🔵 Low | `lib/documents/provider.ts` | `TesseractOCRProvider.extract` signature mismatched with `OCRProvider` interface |
| 🔵 Low | `middleware.ts` | Local `Window` interface shadows global DOM type → rename `RateLimitWindow` |
| 🔵 Low | `middleware.ts` | Route strings duplicated across matcher/hook/deprecation header |

---

## Files Needing Immediate Attention (deduplicated, highest-impact first)

1. **`lib/documents/provider.ts`** — MockOCRProvider default (data correctness + security), hard-coded English OCR, module singleton, MIME strategy
2. **`middleware.ts`** — No auth on upload routes, IP spoof bypass, broken in-memory rate limit, unbounded Map
3. **`hooks/useDocumentUpload.ts`** — God hook, fire-and-forget embedding, no fetch timeout, PII in sessionStorage, still calls deprecated endpoint
4. **`components/upload-form.tsx`** — A11y violations (status messages, focus order, icon labels), inline JSX anti-pattern, duplicated preview UI
5. **`lib/image-utils.ts`** — No SSR guard on browser APIs, HEIC double-buffering

---

## Model Tiers Used

| Role | Model Tier |
|------|-----------|
| Principal Engineer | default |
| Security Auditor | default |
| DevOps Engineer | fast |
| Accessibility Auditor | fast |
| Patterns Auditor | fast |

---

## Worker Execution Summary

| Batch | Workers | Roles |
|-------|---------|-------|
| Batch 1 (parallel) | 4 | Principal, Security, DevOps, A11y |
| Batch 2 (parallel) | 1 | Patterns |
| **Total** | **5** | All roles |

---

*Generated by audit-all orchestrator · 2026-03-30T12:44Z*  
*Individual reports: `audit-reports/AUDIT-2026-03-30-1244/individual/`*
