# Branch Summary — `feature/team-3-Post-Upload-Chunking-&-Embedding-into-EntityDB`

> **Last updated:** 2026-03-28
> **Author:** Team 3

---

## Commit 1 — `d2cb6b3` · feat(team-3): text chunking, RAG persistence, extraction middleware, and upload UX alignment

Updated `README.md` with 81 lines of documentation covering the chunking pipeline, EntityDB persistence, and upload flow architecture introduced by Team 3.

---

## Commit 2 — `c0aef1e` · final push

Housekeeping: removed `.DS_Store` artifact from `app/api/`, updated `.vscode/settings.json`, added `playwright.config.ts` for E2E test infrastructure, and patched the last Playwright run result.

---

## Commit 3 — `16164c1` · Add imports to `hooks/useDocumentUpload.ts`

Added missing imports (`persistOCRToEntityDB` and `chunkText`) that the subsequent chunking block depended on.

---

## Commit 4 — `ad8463d` · Insert fire-and-forget chunking block

Wired the RAG pipeline into the upload flow. After `persistOCRToEntityDB` completes, extracted text is now chunked via `chunkText` and stored into EntityDB in a fire-and-forget block — placed before the `sessionStorage` write so the UI doesn't block on it.

---

## Commit 5 — `1ee7d98` · Add Authentication to All API Routes

Added API key authentication middleware to all routes. Also added the full audit report (`AUDIT-2026-03-28-1504`) covering security, accessibility, DevOps, and principal engineer perspectives.

---

## Commit 6 — `a612271` · Extend Rate Limiting to All Endpoints and Fix the In-Memory Store

**This is the most security-critical commit on the branch.**

- Replaced the broken in-memory `globalThis` rate-limit Map (which reset on every serverless cold start) with **Upstash Redis** via `@upstash/ratelimit`, using a sliding window of 10 requests per 60 seconds.
- Added a **CSRF protection layer** — a `/api/csrf` bootstrap endpoint issues a token cookie; all mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`) must present a matching `x-csrf-token` header, enforced in `middleware.ts`.
- Added `lib/api-security.ts` with helpers (`hasValidCsrfRequest`, `hasUpstashRateLimitEnv`, `shouldFailClosedForRateLimit`) and 125 lines of unit tests in `lib/api-security.test.ts`.
- Updated `lib/api-client.ts` to automatically fetch and attach the CSRF token on all mutating requests.
- Added `app/api/csrf/route.ts` as the token-issuing endpoint.

> ⚠️ **Action required before production deploy — tracked as a follow-up ticket:**
> Two environment variables must be set in the Vercel project for rate limiting to function.
> Without them, the middleware will **fail closed** in production (returning `500` on all mutating requests).
>
> | Variable | Where to get it |
> |---|---|
> | `UPSTASH_REDIS_REST_URL` | Upstash dashboard → your database → REST API tab |
> | `UPSTASH_REDIS_REST_TOKEN` | Upstash dashboard → your database → REST API tab |
>
> Add both in **Vercel → Project Settings → Environment Variables** for production, preview, and development.
> Create a free database at [upstash.com](https://upstash.com) if one does not already exist.

---

## Commit 7 — `78cddd7` · Add Input Length Validation on All Text-Processing Endpoints

Added a shared `MAX_INPUT_LENGTH` constant in `lib/constants.ts` and enforced it at the route level on `/api/ask`, `/api/safety`, `/api/summarize`, and `/api/translate`. Each endpoint now returns a `400` before hitting any AI provider if the payload exceeds the limit. Accompanied by 155 lines of new unit tests across all four route test files.

---

## Commit 8 — `66219ab` · Remove Double-Chunking into EntityDB

Removed a duplicate chunking call that had been accidentally left in `hooks/useDocumentUpload.ts`, which was causing every upload to write to EntityDB twice.

---

## Commit 9 — `77c0e74` · Fix Synchronous File I/O and Hardcoded Request ID in Logging

Rewrote `app/actions/logging.ts` to use async file I/O (previously blocking the event loop with sync writes) and replaced a hardcoded static request ID with a dynamically generated one per invocation.

---

## Commit 10 — `be9ffcf` · Refactor God Component: `TranslatePage`

Decomposed `app/translate/[id]/page.tsx` from 491 lines / 13 state variables into three focused units:

| New file | Responsibility |
|---|---|
| `hooks/useTranslation.ts` | Session recovery from `sessionStorage` + translation API orchestration |
| `hooks/useReadAloud.ts` | TTS audio generation, blob URL lifecycle, and auto-play logic |
| `components/features/tts/VoiceFilterDialog.tsx` | Voice gender/accent picker dialog |

`TranslatePage` is now 286 lines with only 3 remaining `useState` calls (dialog open state, gender, and accent).
