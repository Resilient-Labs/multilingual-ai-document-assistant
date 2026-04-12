# Consolidated Audit Report

**Date:** 2026-04-03  
**Scope:** Ask UI feature on the Translate page  
**Files:** `app/translate/[id]/page.tsx`, `components/features/ask/AskTab.tsx`, `app/api/ask/route.ts`, `lib/entitydb.ts`

---

## Executive Summary

| Role | High | Medium | Low | Status |
|------|------|--------|-----|--------|
| Principal Engineer | 4 | 10 | 5 | critical |
| Security Auditor | 2 | 3 | 2 | critical |
| DevOps Engineer | 3 | 11 | 11 | critical |
| Accessibility Auditor | 1 | 5 | 5 | warn |
| Patterns Auditor | 0 | 5 | 17 | warn |
| **Totals** | **10** | **34** | **40** | |

---

## Top 5 Action Items

### 1. Add Authentication & Rate Limiting to `/api/ask` (Security + DevOps)
The API route is completely unauthenticated and has no rate limiting. Once LLM integration goes live, this becomes a direct cost-abuse vector. No `middleware.ts` exists for route-level protection.
- **Fix:** Add session validation, create `middleware.ts` with deny-by-default for `/api/*`, add rate limiting (e.g., `@upstash/ratelimit`).

### 2. Move RAG Chunk Retrieval Server-Side (Security)
The client controls the `chunks` array sent to `/api/ask`, enabling prompt injection when LLM integration is live. An attacker can call the API directly with crafted payloads.
- **Fix:** Accept only `docId` + `question` from the client; perform chunk retrieval server-side from a trusted data source.

### 3. Decompose God Component `TranslatePage` (Principal + Patterns)
At 496 lines with 13 `useState` hooks and 6+ responsibilities, this component is far past the threshold for maintainability. Translation, TTS, voice settings, and session hydration are all tangled together.
- **Fix:** Extract `useTranslateSession(id)`, `useTextToSpeech()`, `<VoiceSettingsDialog>`. Keep `TranslatePage` as a thin orchestrator.

### 4. Add `AbortController` to All Client Fetches (Principal + DevOps)
Zero `AbortController` usage across the entire codebase. All client-side fetches are fire-and-forget, risking stale state updates on unmount and wasted bandwidth.
- **Fix:** Add `AbortController` to every `useEffect`/`useCallback` that calls `fetch`.

### 5. Add Runtime Input Validation on API Route (Security + Principal)
`/api/ask` uses TypeScript `as` casts with zero runtime validation. Malicious payloads with wrong types will pass through unchecked.
- **Fix:** Add Zod schema validation at the route boundary with max lengths.

---

## Per-Role Findings

### Principal Engineer
Full report: [`individual/principal.md`](../individual/principal.md)

**High (4):**
1. God Component — `TranslatePage` at 496 lines with 13 state hooks
2. No `AbortController` on any fetch (codebase-wide)
3. Dead `docId` prop in `AskTab` — accepted but never used
4. `handleSubmit` is 80-line mega-function with fragile dual-mode JSON/streaming parse

**Medium (10):** `sessionStorage` as sole data transport, non-null assertions bypassing TS narrowing, `useEffect` depending on object reference, ObjectURL lifecycle confusion, array index as React key, no AbortController on streaming fetch, stale closure risk with `isLoading`, stub route with TODO debt, no input validation with unsafe `as` casts, module-level singleton not HMR-resilient.

### Security Auditor
Full report: [`individual/security.md`](../individual/security.md)

**High (2):**
1. SEC-01 — Unauthenticated `/api/ask` route (OWASP A01)
2. SEC-02 — Client-controlled RAG chunks enable prompt injection (OWASP A03/A04)

**Medium (3):** No runtime body validation, no rate limiting, reflected user content in response.

**Hardening (2):** Missing HTTP security headers in `next.config.js`, no global route protection middleware.

### DevOps Engineer
Full report: [`individual/devops.md`](../individual/devops.md)

**High (3):**
1. Streaming contract mismatch — client reads stream but API returns single JSON blob
2. Unbounded request body — no size cap on `/api/ask`
3. No rate limiting on public endpoint

**Medium (11):** Empty catch with no logging, no structured logs/correlation IDs, no timeouts on fetches, silent EntityDB fallback, hardcoded EntityDB config, no env validation, no health endpoint, sessionStorage size limits, TTS blob memory, missing security headers.

### Accessibility Auditor
Full report: [`individual/a11y.md`](../individual/a11y.md)

**High (1):**
1. Send button has no accessible name during loading state (WCAG 4.1.2)

**Medium (5):** Non-unique page title (2.4.2), `CardTitle` renders as `<div>` instead of headings (1.3.1), RadioGroup labels not programmatically associated (4.1.2), errors not linked to input via `aria-describedby` (3.3.1), streaming content not announced via live region (4.1.3).

### Patterns Auditor
Full report: [`individual/patterns.md`](../individual/patterns.md)

**Medium (5):**
1. Parallel async fetch/error/loading pattern duplicated for translation and TTS
2. Duplicate JSON "answer" detection in stream loop and after close
3. Repeated "update last assistant message" state mutations
4. Unused `docId` prop — contract mismatch between UI and data layer
5. Client `fetch` + JSON error handling duplicated across 3 call sites

**Low (17):** Various extraction opportunities for custom hooks (`useTranslateSession`, `useReadAloudAudio`, `useDocumentAsk`), shared components (`CenteredSpinner`, `ChatMessageBubble`), constants (`LANGUAGE_LABELS`, API route strings), and shared types/schemas.

---

## Files Needing Immediate Attention

| File | Roles Flagging | Highest Severity |
|------|---------------|------------------|
| `app/api/ask/route.ts` | Security, DevOps, Principal, Patterns | High |
| `components/features/ask/AskTab.tsx` | Principal, A11y, DevOps, Patterns | High |
| `app/translate/[id]/page.tsx` | Principal, A11y, Patterns | High |
| `lib/entitydb.ts` | Principal, DevOps, Patterns | Medium |
| `next.config.js` (not in scope but referenced) | Security, DevOps | Medium |
| `middleware.ts` (missing) | Security | High |

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

- **Batch 1 (4 concurrent):** Principal, Security, DevOps, A11y
- **Batch 2 (1):** Patterns
- **Total workers spawned:** 5
