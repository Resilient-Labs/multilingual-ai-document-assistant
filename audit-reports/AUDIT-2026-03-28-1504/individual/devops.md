# DEVOPS AUDIT — 2026-03-28-1504
## Scope: Full Project

Audit focused on `app/api/**`, `lib/**`, `middleware.ts`, `next.config.js`, `package.json`, `.github/workflows/**`, `.gitignore`, and `.env.local.example`, plus deployment-related gaps (no Dockerfile in repo).

### High Severity (production incidents)

- **In-memory rate limiting is not safe for scaled or serverless deployments.** `middleware.ts` stores counters on `globalThis` in a single process. With multiple Node workers, containers, or serverless regions, limits are inconsistent and easily bypassed; counters also reset on cold start.
- **Server action `logDocumentSubmission` writes to `logs/logs.json` on the local filesystem** (`app/actions/logging.ts`). This is unreliable on read-only or ephemeral filesystems (common on Vercel/serverless), unsafe under concurrent writes, and unsuitable for multi-instance aggregation. It is not a production logging strategy.
- **Outbound HTTP calls have no timeouts or AbortSignal.** `fetch` to DeepL (`app/api/translate/route.ts`), OpenRouter (`app/api/safety/route.ts`), Deepgram and Replicate (`lib/tts/providers/*.ts`) can hang until the platform default, tying up serverless execution time or worker capacity and complicating incident response.
- **Top-level error handling on `POST /api/documents/extract` swallows failures.** The outer `catch` returns `internalError("Extraction failed")` without logging the exception (`app/api/documents/extract/route.ts`), so real production failures may produce no actionable log line.
- **No dedicated health or readiness endpoint** (e.g. `/api/health`) was found. Load balancers, Kubernetes probes, and synthetic monitors cannot distinguish “app up” from “app process hung on bad dependency.”
- **Cost and abuse exposure on billable third-party routes.** Middleware rate limiting applies only to `POST` on `/api/documents/extract` and `/api/documents/upload` (`middleware.ts` `config.matcher`). `/api/translate`, `/api/tts`, `/api/safety`, and future LLM routes are not rate-limited; large JSON bodies are not bounded in those handlers, which risks runaway spend and resource exhaustion when API keys are configured.

### Medium Severity (operational risk)

- **No startup schema validation for environment variables.** Optional `process.env` reads are scattered (e.g. `DEEPL_API_KEY`, `OPEN_ROUTER_API_TOKEN`, TTS keys). Misconfiguration is discovered at first failing request, not at deploy time (no fail-fast).
- **Two CI workflow files with overlapping purpose but different behavior:** `.github/workflows/ci.yml` runs `npm ci` and `build` on `main`; `.github/workflows/ci.yaml` runs `npm install`, `lint`, `typecheck`, and `build` on PRs to `dev` and `main`. Duplicate “CI” names and mixed `npm ci` vs `npm install` increase drift and make “green CI” ambiguous.
- **`.env.local.example` omits documented production variables** such as `OPEN_ROUTER_API_TOKEN` (required by `/api/safety` per README and code), weakening onboarding and deploy checklist accuracy.
- **DeepL base URL is hardcoded to the free API** (`https://api-free.deepl.com/v2/translate` in `app/api/translate/route.ts`). Pro subscribers need a different host; this is an operational footgun for production cutover.
- **`/api/safety` may forward upstream error text to clients** on provider failure (`detail: upstreamMessage` in the 502 response). That can leak vendor-specific messages and complicate support; it also differs from other routes that return generic messages.
- **No container deployment assets in-repo** (no Dockerfile). Checklist items such as non-root user, pinned Node base image, and migration separation are not satisfied by repository artifacts; teams must supply external runbooks.
- **Heavy work runs inline in request paths.** OCR (Tesseract worker per image in `lib/documents/provider.ts`), PDF/DOC parsing, and TTS (including Replicate `run`) execute synchronously in API handlers without queues, backpressure, or worker isolation—risking latency spikes and noisy neighbors on shared hosting.
- **`POST /api/upload` returns `{ success: true }` with a TODO** (`app/api/upload/route.ts`), which is misleading for any client or monitor that treats HTTP 200 as “upload succeeded.”
- **Retries are minimal and not exponential backoff for HTTP.** TTS uses sequential provider fallback (`lib/tts/router.ts`), which is reasonable for alternate vendors but is not the same as bounded retries with backoff for transient 5xx/429 from a single provider.
- **OCR failure path can surface raw error content** in the JSON error and logs (`ocrFailureError`, `console.error("[OCR] extraction failed:", err)`), which may include filenames or library messages; logging is not structured or redacted.

### Low Severity (hardening)

- **`next.config.js` does not set security headers** (CSP, HSTS, `X-Frame-Options`, etc.); defaults depend entirely on the hosting platform.
- **Logging is mostly unstructured `console.error` / `console.warn`** across API and TTS code. There is no consistent JSON log shape, log level policy, or request/correlation ID propagated from middleware into handlers.
- **`logDocumentSubmission` uses a hardcoded `requestId`** and human-readable timestamps in America/New_York, which hinders distributed tracing and cross-region operations.
- **No `instrumentation.ts` or OpenTelemetry** hooks were found for tracing/metrics integration.
- **No explicit `SIGTERM` / graceful shutdown handlers** in application code; reliance is on Next.js/Node defaults, which may be acceptable but is undocumented for container operators.
- **Next.js image remote patterns:** current `next/image` usage is local (`/logo.svg` in `app/page.tsx`); no `images.remotePatterns` is required today, but the config does not document a policy for future remote assets.
- **Middleware runs an O(n) sweep** over the rate-limit map on every limited `POST` to delete expired entries (`middleware.ts`); at very large IP cardinality this adds avoidable CPU on the edge.
- **Unhandled rejection handling** is not customized; `useDocumentUpload` calls `logDocumentSubmission(...).catch(() => {})`, silently discarding logging failures on the client path.

### Summary

Persistent data and embeddings are intentionally client-side (`lib/entitydb.ts`); there is **no server database connection pool** to audit. **ISR/SSG/route caching** are not central to the current API-heavy, stateless server design. **Migrations** are not applicable to the current architecture (no server DB migrations in scope).

🔴 High: 6  🟡 Medium: 10  🔵 Low: 8
