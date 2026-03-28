# SECURITY AUDIT — 2026-03-28-1504
## Scope: Full Project

Auditor: Senior Application Security Engineer
Framework: OWASP Top 10 (2021)
Project: Next.js multilingual AI document assistant

---

### Critical / High Severity

#### HIGH-1: All API Routes Unauthenticated — Paid API Key Abuse (A01)

**Affected files:**
- `app/api/translate/route.ts`
- `app/api/tts/route.ts`
- `app/api/safety/route.ts`
- `app/api/ask/route.ts`
- `app/api/summarize/route.ts`
- `app/api/documents/extract/route.ts`
- `app/api/upload/route.ts`

**Finding:** Zero authentication or authorization on any API route. No session checks, no API key validation, no middleware auth guard. Any internet-facing client can call these endpoints directly.

**Impact:** An attacker can proxy requests through your server to consume paid third-party APIs (DeepL, Deepgram, Replicate, OpenRouter) at your cost. The `/api/translate`, `/api/tts`, and `/api/safety` routes each forward requests to paid services using server-side secrets.

**Remediation:** Add authentication middleware (e.g., NextAuth.js session check, API key header validation, or at minimum CSRF token verification for same-origin enforcement). Apply globally via `middleware.ts` matcher.

---

#### HIGH-2: Rate Limiting Covers Only 2 of 8 API Endpoints (A04)

**Affected file:** `middleware.ts` (line 87-89)

```
export const config = {
  matcher: ["/api/documents/extract", "/api/documents/upload"],
};
```

**Finding:** Rate limiting is applied only to `/api/documents/extract` and `/api/documents/upload`. The remaining endpoints — `/api/translate`, `/api/tts`, `/api/safety`, `/api/ask`, `/api/summarize` — have no rate limiting. These routes call paid external APIs.

**Impact:** Without rate limits, an attacker can send thousands of requests to `/api/translate` or `/api/tts`, amplifying costs on DeepL, Deepgram, and Replicate accounts. The `/api/safety` endpoint calls OpenRouter, also unbounded.

**Remediation:** Extend the middleware matcher to cover all `/api/*` routes, or add per-route rate limiting.

---

#### HIGH-3: No Input Length Validation on Text-Processing Endpoints (A04)

**Affected files:**
- `app/api/translate/route.ts` — no max length on `text`
- `app/api/summarize/route.ts` — no max length on `fullText`
- `app/api/ask/route.ts` — no max length on `question` or `context`
- `app/api/safety/route.ts` — no max length on `fullText` or `blocks`

**Finding:** The TTS route correctly enforces `MAX_TTS_TEXT_LENGTH = 8000`, but the translate, summarize, ask, and safety routes accept arbitrary-length text bodies with no upper bound.

**Impact:** An attacker can send multi-megabyte text payloads to amplify costs on upstream APIs (DeepL charges by character, OpenRouter by token). Also risks server memory exhaustion and upstream API rejection.

**Remediation:** Add explicit max-length validation to each route's text input. Example: cap `/api/translate` text to 10,000 characters, `/api/safety` to 50,000 characters, etc.

---

### Medium Severity

#### MED-1: Upstream Error Details Leaked to Client (A05)

**Affected file:** `app/api/safety/route.ts` (lines 271-280)

```typescript
return NextResponse.json(
  {
    error: "Safety provider returned an error",
    code: "UPSTREAM_ERROR",
    detail: upstreamMessage,  // <-- leaks provider error text
    status: res.status,
  },
  { status: 502 },
)
```

**Finding:** When the OpenRouter API returns an error, the raw upstream error message is forwarded to the client via the `detail` field. This can expose internal architecture details, model names, rate-limit information, or account-specific error messages from the LLM provider.

**Remediation:** Log the upstream error server-side only. Return a generic error message to the client. Remove the `detail` and `status` fields from the client response.

---

#### MED-2: Rate Limiter Trusts Spoofable X-Forwarded-For Header (A01)

**Affected file:** `middleware.ts` (lines 24-31)

```typescript
function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const ip = forwardedFor.split(",")[0]?.trim();
    if (ip) return ip;
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}
```

**Finding:** The rate limiter identifies clients by the `X-Forwarded-For` header, which can be set by any client making direct requests. An attacker can rotate this header value on each request to bypass rate limits entirely (each spoofed IP gets its own fresh window).

**Remediation:** If deployed behind a trusted reverse proxy (Vercel, Cloudflare), use the platform's verified client IP. If direct-facing, fall back to socket IP or add secondary fingerprinting. Consider using Vercel's `request.ip` property.

---

#### MED-3: In-Memory Rate Limiter Fails in Serverless Deployments (A04)

**Affected file:** `middleware.ts` (lines 12-22)

**Finding:** Rate limit state is stored in a `globalThis` Map. In serverless environments (Vercel Edge, AWS Lambda), each function invocation can run in a separate instance. The rate limit state is not shared across instances, making it ineffective at scale.

**Remediation:** For production, use a distributed rate limiter (e.g., Upstash Redis with `@upstash/ratelimit`, Vercel KV, or Cloudflare Workers KV).

---

#### MED-4: Server Action Writes to Disk Without Input Validation or Size Bounds (A04, A03)

**Affected file:** `app/actions/logging.ts` (lines 26-66)

**Finding:** The `logDocumentSubmission` Server Action accepts `sourceLang` and `targetLang` strings from the client and writes them directly to `logs/logs.json` without any validation or sanitization. While the data is JSON-serialized (preventing injection), there is no:
- Input validation (strings could be arbitrarily long)
- Log file size limit (unbounded growth via repeated calls)
- Authentication (any client can trigger this action)

Additionally, the `requestId` is hardcoded (`'9f3c1a52-8a3b-4c28-b1b4-8e7d2e12f9aa'`), making it useless for correlation.

**Impact:** An automated script could call this action in a loop, growing the log file until disk space is exhausted. The action is a `'use server'` export, invocable by any client.

**Remediation:** Validate input strings (max length, allowed characters). Add log rotation or a max file size check. Generate unique request IDs. Consider rate limiting the action.

---

### Hardening Recommendations

#### HARD-1: No HTTP Security Headers (A05)

**Affected file:** `next.config.js`

**Finding:** `next.config.js` has no `headers()` configuration. The application does not set:
- `Content-Security-Policy`
- `X-Frame-Options` / `X-Content-Type-Options`
- `Strict-Transport-Security`
- `Referrer-Policy`
- `Permissions-Policy`

**Remediation:** Add a `headers()` function in `next.config.js`:

```javascript
async headers() {
  return [{
    source: "/(.*)",
    headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
    ],
  }];
}
```

---

#### HARD-2: No Explicit Request Body Size Limit (A04)

**Finding:** Next.js has a default body size limit (~1MB for API routes), but there is no explicit configuration in `next.config.js` to enforce or customize this. For routes handling multipart uploads (documents/extract), the effective limit is set by `MAX_FILE_SIZE_BYTES` (4.5 MB per file, up to 10 files = 45 MB potential payload).

**Remediation:** Set explicit `bodyParser` limits in the Next.js config or per-route config to match expected maximums.

---

#### HARD-3: Console Error Logging May Expose Sensitive File Content (A02)

**Affected files:**
- `app/api/documents/extract/route.ts:87` — logs full OCR error including potentially sensitive document content
- `app/api/tts/route.ts:84` — logs full error object
- `lib/tts/providers/deepgram.ts:41` — logs upstream error text
- `lib/tts/providers/xtts-replicate.ts:97-100` — logs error object
- `lib/tts/providers/minimax-replicate.ts:119-122` — logs error object

**Finding:** Server-side `console.error` calls log raw error objects and upstream response text. In production, these logs could capture fragments of document text, API response bodies, or error details containing account-specific information.

**Remediation:** Use structured logging with explicit field selection. Avoid logging raw error objects; extract only the message and status code.

---

#### HARD-4: dangerouslySetInnerHTML in Chart Component (A03)

**Affected file:** `components/ui/chart.tsx` (line 83)

**Finding:** The `ChartStyle` component uses `dangerouslySetInnerHTML` to inject CSS. The CSS is constructed from a hardcoded `THEMES` config and a component-scoped `id`, not from user input. Risk is minimal since the data source is developer-controlled.

**Status:** Low risk — no user input flows into the HTML. No action required unless chart config becomes user-configurable.

---

### Items Verified as Secure

| Check | Status |
|---|---|
| Secrets in .env.local (not committed) | `.gitignore` correctly excludes `.env`, `.env.local`, `.env*.local` |
| No NEXT_PUBLIC_ secrets | No `NEXT_PUBLIC_` env vars found in codebase |
| No exec/spawn command injection | No child_process usage found |
| No SQL/NoSQL injection | No database queries — client-side IndexedDB only |
| File upload validation (type, size, count) | Server-side validation in `lib/documents/validation.ts` |
| TTS text length cap | `MAX_TTS_TEXT_LENGTH = 8000` enforced in route |
| Error responses don't leak stack traces | All catch blocks return generic messages |
| path.join used for file paths | `app/actions/logging.ts` uses `path.join` |
| Dynamic route params handled safely | Proper validation in `app/document/[id]/page.tsx` |

---

### Summary

| Severity | Count |
|---|---|
| :red_circle: Critical/High | 3 |
| :yellow_circle: Medium | 4 |
| :blue_circle: Hardening | 4 |

**Key risk:** The primary attack surface is the complete absence of authentication combined with incomplete rate limiting. Any external actor can consume paid API quotas (DeepL, Deepgram, Replicate, OpenRouter) through the unauthenticated endpoints. Adding at minimum a global rate limit across all API routes and an authentication layer would significantly reduce the application's risk profile.
