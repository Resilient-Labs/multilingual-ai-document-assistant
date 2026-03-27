# Security Audit — Chunking and Upload Wiring

**Auditor:** Application Security Auditor
**Date:** 2026-03-27 14:30 ET
**Scope:** Chunking & upload pipeline — OCR extraction, persistence, routing
**Methodology:** OWASP Top 10 (2021) + React/Next.js + Node.js checklists

---

## Scope Files Reviewed

| File | Status |
|------|--------|
| `components/upload-form.tsx` | Reviewed |
| `multilingual-ai-document-assistant/lib/chunking.ts` | Reviewed |
| `lib/entitydb.ts` | Reviewed |
| `lib/entitydb-persist.ts` | Reviewed |
| `types/index.ts` | Reviewed |
| `types/CanonicalDocument.ts` | Reviewed |
| `app/api/documents/extract/route.ts` | Reviewed |
| `app/api/documents/upload/route.ts` | Reviewed (wired from upload-form) |
| `hooks/useDocumentSession.ts` | Reviewed |
| `next.config.js` | Reviewed |
| `app/actions/logging.ts` | Reviewed (called from upload-form) |
| `lib/documents/validation.ts` | Reviewed (called from extract route) |
| `lib/documents/errors.ts` | Reviewed |
| `lib/constants.ts` | Reviewed |

---

## Findings

### 🔴 HIGH-1 — No Rate Limiting on CPU-Intensive Extraction Endpoints (OWASP A04)

**Files:** `app/api/documents/upload/route.ts`, `app/api/documents/extract/route.ts`

Both POST endpoints perform CPU-intensive operations (PDF parsing via `pdf-parse`, DOCX extraction via `mammoth`/`word-extractor`, and OCR provider calls) with no rate limiting, throttling, or request queuing. An attacker can flood these endpoints with concurrent requests to exhaust server CPU and memory, causing denial of service for all users.

Neither endpoint requires authentication, so the attack surface is the public internet.

**Evidence:**
- `app/api/documents/upload/route.ts:64` — `POST` handler with no rate-limit guard
- `app/api/documents/extract/route.ts:38` — `POST` handler with no rate-limit guard
- No `middleware.ts` file exists in the project for global request filtering

**Fix:** Add rate limiting middleware (e.g., `next-rate-limit`, Vercel edge rate limits, or a custom token-bucket in middleware.ts). Scope to IP-based limits on `/api/documents/*` routes. Consider request queuing for OCR operations.

---

### 🟡 MEDIUM-1 — Server Action Writes Unbounded User Input to Disk (OWASP A04 + A01)

**File:** `app/actions/logging.ts:26-61`

The `logDocumentSubmission` server action accepts `sourceLang` and `targetLang` as arbitrary strings with no validation or length limits. These values are appended to a JSON file on disk (`logs/logs.json`). A malicious client can:

1. Call the server action repeatedly to grow the log file unboundedly (disk exhaustion).
2. Pass arbitrarily large strings as language codes to accelerate disk/memory pressure.

The function is a `'use server'` export, meaning Next.js auto-exposes it as a POST endpoint callable by any client.

**Evidence:**
```
// app/actions/logging.ts:26
export async function logDocumentSubmission(
  sourceLang: string,    // no validation, no maxLength
  targetLang: string     // no validation, no maxLength
): Promise<void> {
```

**Fix:** Validate `sourceLang`/`targetLang` against an allowlist of known language codes (e.g., the `LANGUAGES` array from upload-form). Add a max log file size check or use structured logging with rotation. Consider rate limiting the action.

---

### 🟡 MEDIUM-2 — MIME Type Validation Trusts Client-Supplied Headers (OWASP A04)

**Files:** `app/api/documents/upload/route.ts:80`, `lib/documents/validation.ts:83`

Both endpoints validate file type using `file.type`, which is the MIME type sent by the client in the `Content-Type` of the multipart part. This value is trivially spoofable — an attacker can rename a malicious file and set any MIME type in the request.

The upload route additionally falls back to file extension (`file.name.split(".").pop()`) in `extractTextFromFile`, which is also client-controlled.

No magic-byte (file signature) validation is performed on either endpoint.

**Evidence:**
```
// lib/documents/validation.ts:83
if (!ALLOWED_MIME_TYPES.includes(file.type)) {  // file.type is client-controlled
```

```
// app/api/documents/upload/route.ts:80
if (!ALLOWED_MIME_TYPES.includes(file.type)) {  // same issue
```

**Fix:** Add magic-byte validation using a library like `file-type` to verify actual file contents against claimed MIME type. This prevents file-type spoofing and reduces the attack surface on downstream parsers (mammoth, word-extractor, pdf-parse).

---

### 🟡 MEDIUM-3 — No HTTP Security Headers Configured (OWASP A05)

**Files:** `next.config.js`, (no `middleware.ts`)

The application does not configure any HTTP security headers:

- **Content-Security-Policy (CSP):** Not set. The app loads Tesseract.js WASM and libheif-js WASM at runtime. Without CSP, there's no defense against XSS injecting malicious scripts.
- **Strict-Transport-Security (HSTS):** Not set. No enforcement of HTTPS.
- **X-Frame-Options / frame-ancestors:** Not set. The app could be embedded in an iframe for clickjacking.
- **X-Content-Type-Options:** Not set. Browser MIME-sniffing attacks possible.

**Evidence:** `next.config.js` only configures webpack aliases and warning suppression. No `headers()` function. No middleware.ts for header injection.

**Fix:** Add a `headers()` function to `next.config.js` or create `middleware.ts` to set security headers. At minimum: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`. Add CSP with appropriate `script-src` and `worker-src` directives for Tesseract.js and WASM.

---

### 🟡 MEDIUM-4 — Client/Server File Size Limit Mismatch (OWASP A04)

**Files:** `components/upload-form.tsx:215`, `lib/constants.ts:8`

The client-side dropzone accepts files up to **10 MB** (`maxSize: 10 * 1024 * 1024`), but the server rejects files larger than **4.5 MB** (`MAX_FILE_SIZE_BYTES = 4.5 * 1024 * 1024`). This means:

1. Users can select and upload files between 4.5–10 MB that will always be rejected server-side, wasting bandwidth.
2. The inconsistency could mask the true server limit from security testing, allowing oversized payloads to reach the server before rejection.

**Evidence:**
```
// components/upload-form.tsx:215
maxSize: 10 * 1024 * 1024,  // 10 MB client-side

// lib/constants.ts:8
export const MAX_FILE_SIZE_BYTES = 4.5 * 1024 * 1024;  // 4.5 MB server-side
```

**Fix:** Align the client-side `maxSize` with `MAX_FILE_SIZE_BYTES`. Import the constant or define a shared value. Display the correct limit in the UI ("4.5 MB max" instead of "10MB max").

---

### 🔵 LOW-1 — Server-Side Error Logging May Leak Sensitive Context (OWASP A09)

**File:** `app/api/documents/extract/route.ts:87`

The `console.error` call logs the raw error object, which may include file paths, internal library state, or user-uploaded file content fragments in stack traces. In a managed hosting environment, these logs may be persisted and accessible to operators.

**Evidence:**
```
// app/api/documents/extract/route.ts:87
console.error("[OCR] extraction failed:", err);
```

**Fix:** Log only `err.message` and a sanitized identifier. Avoid logging the full error object in production.

---

### 🔵 LOW-2 — Hardcoded Request ID Defeats Audit Trail (OWASP A09)

**File:** `app/actions/logging.ts:52`

Every log entry uses the same hardcoded `requestId`, making it impossible to correlate or distinguish individual requests in the audit log.

**Evidence:**
```
// app/actions/logging.ts:52
requestId: '9f3c1a52-8a3b-4c28-b1b4-8e7d2e12f9aa',  // static for all entries
```

**Fix:** Generate a unique ID per invocation using `crypto.randomUUID()`.

---

### 🔵 LOW-3 — No CSRF Protection on Stateless API Routes (OWASP A01)

**Files:** `app/api/documents/upload/route.ts`, `app/api/documents/extract/route.ts`

The POST endpoints accept `multipart/form-data` without CSRF token validation. While the app currently has no authentication (reducing CSRF impact), a cross-origin form submission could trigger server-side processing. If authentication is added later, these routes would be immediately vulnerable.

**Fix:** Add CSRF protection when authentication is introduced. Consider using `SameSite` cookies and origin-checking middleware.

---

### 🔵 LOW-4 — Unbounded IndexedDB `getAll()` Reads (Client-Side DoS)

**Files:** `hooks/useDocumentSession.ts:71`, `lib/entitydb-persist.ts:145`

Both files read ALL records from the `vectors` IndexedDB store into memory using `store.getAll()`, then filter in JavaScript. If a user accumulates many documents, this linear scan could cause browser tab memory exhaustion or UI freezing.

**Evidence:**
```
// hooks/useDocumentSession.ts:71
const records = await store.getAll();

// lib/entitydb-persist.ts:145
const records = await store.getAll();
```

**Fix:** Use an IDB index on `entityKey` + `document.id` to query directly instead of scanning all records. Alternatively, add pagination or a record count cap.

---

## Items Verified Clean

| Check | Result |
|-------|--------|
| Hardcoded secrets / API keys | ✅ None found |
| `NEXT_PUBLIC_` secret exposure | ✅ No secrets prefixed |
| `dangerouslySetInnerHTML` in scope | ✅ Not used in scope files |
| SQL / NoSQL injection | ✅ N/A — uses IndexedDB, no query interpolation |
| Command injection (`exec`/`spawn`) | ✅ Not used |
| Path traversal | ✅ `path.join` used correctly in logging.ts |
| Sensitive data in client storage | ✅ Only document text stored (by design, zero-retention) |
| JWT / session token handling | ✅ N/A — no auth system in scope |
| Client-side OCR privacy | ✅ Image OCR runs in browser, image never sent to server |
| Document ID generation | ✅ Uses `crypto.randomUUID()` (client) and `uuid.v4()` (server) |
| Error messages to client | ✅ Sanitized, no stack traces exposed |
| Type definitions | ✅ Well-structured, no security implications |
| Chunking logic | ✅ Pure function, no I/O, no injection surface |

---

## Summary

```
═══════════════════════════════════════════════════════════════
  SECURITY AUDIT — Chunking & Upload Wiring — 2026-03-27 14:30
  🔴 High: 1    🟡 Medium: 4    🔵 Hardening: 4
═══════════════════════════════════════════════════════════════
```

| Severity | ID | OWASP | Finding |
|----------|----|-------|---------|
| 🔴 High | HIGH-1 | A04 | No rate limiting on CPU-intensive extraction endpoints |
| 🟡 Medium | MED-1 | A04/A01 | Server action writes unbounded user input to disk |
| 🟡 Medium | MED-2 | A04 | MIME type validation trusts client-supplied headers |
| 🟡 Medium | MED-3 | A05 | No HTTP security headers configured |
| 🟡 Medium | MED-4 | A04 | Client/server file size limit mismatch |
| 🔵 Low | LOW-1 | A09 | Server error logging may leak sensitive context |
| 🔵 Low | LOW-2 | A09 | Hardcoded request ID defeats audit trail |
| 🔵 Low | LOW-3 | A01 | No CSRF protection on stateless API routes |
| 🔵 Low | LOW-4 | A04 | Unbounded IndexedDB getAll() reads |
