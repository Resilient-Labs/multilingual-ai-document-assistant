# DevOps / Platform Audit: Q&A Chat UI

**Scope:** `app/api/ask/route.ts`, `components/features/document/QAPanel.tsx`  
**Auditor role:** DevOps / Platform Engineer  
**Date:** 2026-03-24  
**Focus:** Operational readiness, scalability, deployment hygiene, production risk.

---

## Summary

The `/api/ask` route streams LLM output via the Vercel AI SDK and is the main cost and abuse surface for this feature. The client loads retrieval chunks in the browser (`queryChunks`) and passes them in the POST body. There is **no structured logging, no timeouts on upstream calls, no rate limiting, and no authentication** in these files—so production failures are hard to diagnose, hung requests can tie up workers, and the endpoint is economically exposed. The React panel does not guard against failures from local vector search before the chat request.

---

## Findings

### Observability & Logging

| ID | Severity | Finding |
|----|----------|---------|
| OBS-1 | High | The `catch` block in `POST` returns a generic 500 JSON response and **does not log** the underlying error, stack, or request correlation id. Operators cannot distinguish bad input, OpenAI outages, or SDK bugs in production. |
| OBS-2 | Medium | There is **no structured (JSON) logging** and no log levels (info/warn/error) for successful completions, validation failures (400), or misconfiguration. Critical business events (e.g. “ask completed”, “fallback path used”) are not emitted. |
| OBS-3 | Low | When `OPENAI_API_KEY` is missing, the handler returns **HTTP 200** with an SSE stream containing a warning string. Monitoring that only checks status codes will treat this as success, hiding misconfiguration in staging/production. |

**Notes:** The implementation avoids logging request bodies by default (good for PII), but the absence of *any* safe operational logging (request id, duration, status, error code) is a gap.

---

### Error Handling & Resilience

| ID | Severity | Finding |
|----|----------|---------|
| ERR-1 | High | **`streamText` has no explicit timeout or `abortSignal`**. If the OpenAI API stalls, the connection may remain open until the platform’s default limits, consuming serverless/runtime capacity and hurting user experience. |
| ERR-2 | Medium | **`request.json()`** is unbounded in application logic; very large `messages` or `chunks` payloads can stress memory and parsing time before any validation. (Platform defaults may cap size; this route does not enforce an application-level limit.) |
| ERR-3 | Medium | **`QAPanel.onSubmit`**: `await queryChunks(question)` is not wrapped in try/catch. If EntityDB / embedding fails, the error surfaces as an unhandled rejection in the submit handler after the input was cleared—poor UX and harder to reason about in error monitoring. |
| ERR-4 | Low | The outer `catch` in the route **swallows all error detail** from the client’s perspective (appropriate) but pairs with OBS-1: no server-side record exists for post-mortems. |

**Notes:** No retries with backoff for transient OpenAI failures; acceptable for streaming UX but worth documenting as a product/ops tradeoff.

---

### Configuration & Environment

| ID | Severity | Finding |
|----|----------|---------|
| CFG-1 | Medium | **`OPENAI_API_KEY` and `OPENAI_MODEL`** are read at request time; there is **no startup schema validation** (e.g. zod/env in `instrumentation` or a shared env module) to fail fast when required vars are wrong in production. |
| CFG-2 | Medium | Missing API key behavior returns a **user-facing instructional message in the stream** (helpful locally) but is risky in production if the endpoint is exposed: it confirms configuration state to anonymous callers. |

**Notes:** Health checks (`/health`, `/api/health`) are **out of scope for these files** but are not implemented here; recommend verifying at app level.

---

### Performance & Scalability

| ID | Severity | Finding |
|----|----------|---------|
| PERF-1 | High | **No rate limiting** on `POST /api/ask`. A public deployment allows unbounded calls per client/IP, leading to **runaway OpenAI spend** and potential platform quota exhaustion. |
| PERF-2 | Medium | **No caching** of identical questions/context at the API layer (expected for chat; still a cost lever if traffic is repetitive). Retrieval is client-side (`queryChunks`); server is stateless—good for horizontal scale, but each call still hits the LLM. |
| PERF-3 | Low | Response uses **`toUIMessageStreamResponse()`** (streaming)—appropriate vs buffering full text in memory for the LLM output path. |

---

### Security & Abuse (Platform)

| ID | Severity | Finding |
|----|----------|---------|
| SEC-1 | High | The route is **unauthenticated** in these files. Any caller who can reach the app can consume **organization API quota** and incur cost. (Auth may exist elsewhere; not visible in this handler.) |

---

### Client (`QAPanel.tsx`) — Operational Notes

| ID | Severity | Finding |
|----|----------|---------|
| UI-1 | Low | **`DefaultChatTransport`** points to a relative `/api/ask` URL. Correct for same-origin; for multi-domain or API-gateway setups, this may need an env-based base URL (configuration concern). |
| UI-2 | Low | **`error.message`** is shown to users—acceptable for debugging but ensure upstream never returns sensitive tokens in error bodies (depends on AI SDK / fetch behavior). |

---

### Deployment Signals (Dockerfile / Node image / migrations)

**Not applicable** to the two scoped files. No Dockerfile or migration logic appears here; validate separately in repo root / CI.

---

### Next.js–Specific (Scoped Files)

| ID | Severity | Finding |
|----|----------|---------|
| NXT-1 | Low | Route handler does not set **security headers** (CSP, etc.)—typically centralized in `next.config` or middleware; confirm at project level. |
| NXT-2 | Low | No `export const maxDuration` or runtime segment config in this file; for long LLM streams on Vercel, **explicit `maxDuration`** may be required on the deployment tier—verify for production timeouts. |

---

## Severity Counts

| Level | Count |
|-------|-------|
| High | 4 |
| Medium | 6 |
| Low | 6 |

*(Counts include sub-items grouped under main findings where noted.)*

---

## Recommended Next Steps (Operational)

1. Add **structured logging** with request id, route name, duration, HTTP status, and error code; never log full `body` or raw chunks by default.
2. Attach **`AbortSignal` / timeout** to `streamText` aligned with platform limits and product SLA.
3. Enforce **rate limits** (edge middleware, API gateway, or WAF) on `POST /api/ask`.
4. Require **authentication** or signed sessions before calling the model, unless this is strictly a local-only demo.
5. In `QAPanel`, **catch errors from `queryChunks`** and surface a user-safe message without leaving the flow inconsistent.
6. Validate **env at deploy/startup** and treat missing production keys as **fail-fast** with clear operator alerts (not a 200 SSE “soft success”).

---

*End of report.*
