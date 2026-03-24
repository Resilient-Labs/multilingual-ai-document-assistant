# Consolidated Audit Report

**Date:** 2026-03-24  
**Scope:** `app/api/ask/route.ts`, `components/features/document/QAPanel.tsx`  
**Feature:** Q&A Chat-UI Component Implementation  
**Audit Run:** AUDIT-2026-03-24-1612

---

## Executive Summary

| Role | High | Medium | Low | Status |
|------|------|--------|-----|--------|
| Principal Engineer | 4 | 7 | 0 | Critical |
| Security Auditor | 1 | 3 | 3 | Critical |
| DevOps Engineer | 4 | 6 | 6 | Critical |
| Accessibility Auditor | 0 | 3 | 5 | Warn |
| Patterns Auditor | 0 | 3 | 8 | Clean |
| **Total** | **9** | **22** | **22** | **Critical** |

> **Overall status: Critical** — Multiple high-severity findings across Principal, Security, and DevOps audits must be addressed before merge.

---

## Top 5 Action Items (Must Fix Before Merge)

1. **Add authentication to `POST /api/ask`** — The route handler has zero auth checks. Any anonymous caller can consume OpenAI API credits without restriction. *(Principal F-01, Security SEC-01, DevOps SEC-1)*

2. **Add input validation and payload size limits** — No schema validation on request body. Unbounded `chunks`/`messages` arrays can inflate token costs or cause OOM. Use zod with max lengths/counts. *(Principal F-02, Security SEC-02/SEC-06, DevOps ERR-2)*

3. **Add rate limiting** — No rate limiting on the LLM endpoint. Combined with no auth, an attacker can exhaust the OpenAI budget via automated requests. *(Security SEC-04, DevOps PERF-1)*

4. **Add error logging in the catch block** — The catch clause discards all error information. Production failures are impossible to diagnose. Log with structured metadata (request ID, timestamp, stack). *(Principal F-03, DevOps OBS-1)*

5. **Add error handling in `QAPanel.onSubmit`** — Neither `queryChunks()` nor `sendMessage()` is wrapped in try/catch. Failures leave the UI in a broken state (input cleared, no message sent, no user feedback). *(Principal F-04, DevOps ERR-3)*

---

## Per-Role Findings

### Principal Engineer (4 High / 7 Medium)

| ID | Severity | Finding | File |
|----|----------|---------|------|
| F-01 | High | No authentication on route handler | `route.ts` |
| F-02 | High | No input size validation on chunks/messages | `route.ts` |
| F-03 | High | Silent error swallowing in catch block | `route.ts` |
| F-04 | High | Unhandled async errors in onSubmit | `QAPanel.tsx` |
| F-05 | Medium | Prompt injection via unsanitized chunks | `route.ts` |
| F-06 | Medium | Unsafe type assertions without runtime validation | Both |
| F-07 | Medium | Duplicated chunk extraction logic | `route.ts` |
| F-08 | Medium | Hand-rolled SSE fallback bypasses SDK protocol | `route.ts` |
| F-09 | Medium | Client-side RAG retrieval coupled to UI | `QAPanel.tsx` |
| F-10 | Medium | No conversation length limit | `QAPanel.tsx` |
| F-11 | Medium | Magic string for default model name | `route.ts` |

### Security Auditor (1 High / 3 Medium / 3 Hardening)

| ID | Severity | Finding | OWASP |
|----|----------|---------|-------|
| SEC-01 | High | Unauthenticated API route | A01 |
| SEC-02 | Medium | No request body validation | A03/A04 |
| SEC-03 | Medium | Client-supplied chunks enable prompt injection | A03 |
| SEC-04 | Medium | No rate limiting on LLM endpoint | A04 |
| SEC-05 | Hardening | Infrastructure detail leakage in fallback | A05 |
| SEC-06 | Hardening | No payload size limits | A04 |
| SEC-07 | Hardening | Raw error object rendered in client UI | A05 |

### DevOps Engineer (4 High / 6 Medium / 6 Low)

| ID | Severity | Finding |
|----|----------|---------|
| OBS-1 | High | Catch block does not log errors |
| ERR-1 | High | `streamText` has no timeout or abortSignal |
| PERF-1 | High | No rate limiting on `/api/ask` |
| SEC-1 | High | Route is unauthenticated (cost exposure) |
| OBS-2 | Medium | No structured logging or log levels |
| ERR-2 | Medium | Unbounded request body size |
| ERR-3 | Medium | `queryChunks` not wrapped in try/catch |
| CFG-1 | Medium | No startup env var validation |
| CFG-2 | Medium | Missing key returns user-facing config details |
| PERF-2 | Medium | No caching for repeated queries |
| OBS-3 | Low | Missing key returns HTTP 200 (monitoring blind spot) |
| ERR-4 | Low | Error detail swallowed server-side |
| UI-1 | Low | Relative API URL (multi-domain concern) |
| UI-2 | Low | Raw `error.message` shown to users |
| NXT-1 | Low | No security headers in route file |
| NXT-2 | Low | No `maxDuration` export for Vercel |

### Accessibility Auditor (0 High / 3 Medium / 5 Low)

| ID | Severity | Finding | WCAG |
|----|----------|---------|------|
| A11Y-1 | Medium | Panel title is not a real heading; no landmark | 1.3.1, 2.4.6 |
| A11Y-2 | Medium | Chat messages lack speaker semantics for AT | 1.3.1 |
| A11Y-3 | Medium | No `aria-live` region for streaming/new content | 4.1.3 |
| A11Y-4 | Low | Spinner + "Thinking…" redundancy for AT | 4.1.2 |
| A11Y-5 | Low | Send icon SVG should be `aria-hidden` | 1.1.1 |
| A11Y-6 | Low | Scroll sentinel div should be `aria-hidden` | 4.1.2 |
| A11Y-7 | Low | Input uses `aria-label` but no visible `<label>` | — |
| A11Y-8 | Low | Optional focus management after submit | — |

### Patterns Auditor (0 High / 3 Medium / 8 Low)

| ID | Severity | Finding |
|----|----------|---------|
| PA-1 | Medium | Repeated `chunks` extraction in two branches |
| PA-2 | Medium | Bifurcated body parsing without named abstraction |
| PA-3 | Medium | Overlapping legacy context normalization |
| PA-4 | Low | System prompt as inline string assembly |
| PA-5 | Low | Manual SSE fallback stream (extract if reused) |
| PA-6 | Low | Duplicated assistant-loading spinner affordances |
| PA-7 | Low | Chat row presentation not componentized |
| PA-8 | Low | `getMessageText` could move to shared lib |
| PA-9 | Low | Scroll-to-bottom hook extraction opportunity |
| PA-10 | Low | Hardcoded API path `/api/ask` |
| PA-11 | Low | No shared validation utility across routes |

---

## Files Needing Immediate Attention

| File | Critical Findings |
|------|-------------------|
| `app/api/ask/route.ts` | Auth (F-01/SEC-01/SEC-1), validation (F-02/SEC-02), error logging (F-03/OBS-1), timeout (ERR-1), rate limiting (SEC-04/PERF-1) |
| `components/features/document/QAPanel.tsx` | Error handling in onSubmit (F-04/ERR-3), a11y live region (A11Y-3), speaker semantics (A11Y-2) |

---

## Model Tiers Used

| Role | Model Tier |
|------|------------|
| Principal Engineer | default |
| Security Auditor | default |
| DevOps Engineer | fast |
| Accessibility Auditor | fast |
| Patterns Auditor | fast |

---

## Worker Execution Summary

- **Batch 1 (parallel):** Principal, Security, DevOps, Accessibility — 4 workers
- **Batch 2 (parallel):** Patterns — 1 worker
- **Total workers spawned:** 5

---

## Individual Reports

- [`principal.md`](../individual/principal.md)
- [`security.md`](../individual/security.md)
- [`devops.md`](../individual/devops.md)
- [`a11y.md`](../individual/a11y.md)
- [`patterns.md`](../individual/patterns.md)
