# Security Audit — Chunking Pipeline + Upload Wiring

**Auditor:** Application Security Auditor (OWASP Top 10)
**Date:** 2026-03-23
**Scope:** 15 files — document extraction API, upload wiring, chunking pipeline, validation, types

---

## Findings

### 🔴 SEC-1 — No Authentication on API Routes

**OWASP:** A01 (Broken Access Control)
**Files:** `app/api/documents/extract/route.ts`, `app/api/documents/upload/route.ts`, `app/api/upload/route.ts`
**Lines:** `extract/route.ts:38`, `upload/route.ts:13`, `upload/route.ts:3` (app/api/upload)

All three API route handlers accept unauthenticated POST requests. There is no session check, API key validation, or authentication middleware. The `/api/documents/extract` endpoint performs server-side OCR processing, which is computationally expensive and could incur cloud-provider costs.

An attacker can:
- Flood the extraction endpoint to cause resource exhaustion or cost abuse.
- Use the OCR service as a free document-processing oracle.

```
// extract/route.ts:38 — no auth check before processing
export async function POST(request: Request) {
  try {
    const validationResult = await parseAndValidateFiles(request);
    // ... processes file immediately
```

**Fix:** Add authentication middleware (e.g., NextAuth session check or API key header validation) before processing any upload or extraction request.

---

### 🟡 SEC-2 — MIME Type Validation Relies on Client-Provided Value (Bypassable)

**OWASP:** A04 (Insecure Design)
**File:** `lib/documents/validation.ts`
**Line:** 83

File type validation checks `file.type`, which is derived from the `Content-Type` of the multipart form part. This value is entirely client-controlled and trivially spoofable. An attacker can upload an arbitrary file (e.g., HTML, SVG with embedded scripts, executable) by setting the MIME type to `application/pdf`.

```
// validation.ts:83 — file.type is client-controlled
if (!ALLOWED_MIME_TYPES.includes(file.type)) {
```

No magic-byte / file-header validation is performed on the actual file content.

**Fix:** Validate file content by reading the first few bytes (magic bytes) to confirm the actual file type matches the declared MIME type. Libraries like `file-type` (npm) can do this from a `Buffer`.

---

### 🟡 SEC-3 — No Rate Limiting on Extraction Endpoints

**OWASP:** A04 (Insecure Design)
**Files:** `app/api/documents/extract/route.ts`, `app/api/documents/upload/route.ts`

The extraction endpoint accepts up to 10 files per request (`MAX_FILES_PER_REQUEST = 10`), each up to 4.5 MB, and runs OCR on every one. There is no rate limiting at the route or middleware level. Combined with the lack of authentication (SEC-1), this makes the endpoint vulnerable to denial-of-service via resource exhaustion.

**Fix:** Add rate limiting middleware (e.g., per-IP or per-session token bucket) using `next-rate-limit`, Vercel Edge Config, or an upstream WAF rule.

---

### 🔵 SEC-4 — Unprotected Stub Endpoint Returns Success for Any Request

**OWASP:** A05 (Security Misconfiguration)
**File:** `app/api/upload/route.ts`
**Lines:** 1–7

This endpoint is a no-op stub that returns `{ success: true }` for any POST request. If reachable in production, it misleads clients into believing an upload succeeded when nothing was processed or stored.

```
// app/api/upload/route.ts — stub endpoint
export async function POST() {
  return NextResponse.json({ success: true });
}
```

**Fix:** Remove the stub or add a `501 Not Implemented` response until the endpoint is wired up. Alternatively, gate it behind a feature flag or auth check.

---

### 🔵 SEC-5 — Client-Side Upload Accepts Broader File Types Than Server Allows

**OWASP:** A04 (Insecure Design)
**Files:** `components/upload-form.tsx` (lines 128–134), `lib/constants.ts` (lines 14–19)

The client-side dropzone accepts `.doc`, `.docx`, `.txt`, and `image/*` (including `.heic`), but the server-side allowlist (`ALLOWED_MIME_TYPES`) only permits PDF, JPEG, PNG, and WebP. Users can select files the server will always reject, creating a confusing experience. More importantly, the broader client-side allowlist suggests the developer may intend to support these types in the future — if the server allowlist is widened without proper content validation, new attack surface opens.

**Fix:** Align the client-side `accept` config with the server-side `ALLOWED_MIME_TYPES` to prevent user confusion and reduce attack surface drift.

---

### 🔵 SEC-6 — Uploaded Filename Reflected in Responses Without Sanitization

**OWASP:** A03 (Injection)
**Files:** `app/api/documents/upload/route.ts` (line 44, 59), `lib/documents/errors.ts` (lines 30, 44)

User-controlled `file.name` is interpolated into OCR placeholder text and error message strings that are returned in JSON responses. While JSON serialization and React's auto-escaping provide defense-in-depth for the current frontend, downstream consumers (mobile apps, logging pipelines, admin dashboards) that render these values as HTML without escaping would be vulnerable to reflected XSS.

```
// upload/route.ts:44 — filename in OCR placeholder
fullText: `[OCR placeholder for ${file.name}]`,

// errors.ts:30 — filename in error detail
`Invalid file type: ${mimeType}. Allowed: PDF, JPEG, PNG, WebP.`,
```

**Fix:** Sanitize `file.name` (strip or encode special characters) before embedding it in any response body or log output.

---

## Items Checked — No Issues Found

| OWASP Category | Status |
|---|---|
| A02 — Cryptographic Failures | ✅ No hardcoded secrets, API keys, or passwords in scope. No PII logged. |
| A03 — Injection (SQL/NoSQL/Cmd) | ✅ No raw SQL, no exec/spawn, no `dangerouslySetInnerHTML`. EntityDB uses structured inserts. |
| A07 — Auth & Session | ✅ N/A — no auth system in scope (see SEC-1 for missing auth). |
| React/Next.js — NEXT_PUBLIC_ secrets | ✅ No secrets exposed via public env vars. |
| React/Next.js — Server Actions | ✅ No Server Actions in scope; route handlers used instead. |
| Node.js — Path traversal | ✅ No file-system path construction with user input. |
| Node.js — Stack trace leakage | ✅ Catch blocks return generic messages, not stack traces. |

---

## Summary

| Severity | Count | IDs |
|---|---|---|
| 🔴 High | 1 | SEC-1 |
| 🟡 Medium | 2 | SEC-2, SEC-3 |
| 🔵 Hardening | 3 | SEC-4, SEC-5, SEC-6 |

<!-- ═══════════════════════════════════════════
   SECURITY AUDIT — Chunking Pipeline + Upload Wiring — 2026-03-23
   🔴 Critical: 1  🟡 Medium: 2  🔵 Hardening: 3
   ═══════════════════════════════════════════ -->
