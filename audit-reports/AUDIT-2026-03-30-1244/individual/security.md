# Security Audit Report

**Audit ID:** AUDIT-2026-03-30-1244  
**Role:** Application Security Auditor  
**Date:** 2026-03-30  
**Commit Range:** `09f36063760fd12014dbcb78d8d8a1e039733627..f074c1de51388f1d66743e84a7eea23bdfdc402f`

## Files Audited

| File | Status |
|------|--------|
| `app/api/documents/upload/route.ts` | ⚠️ Findings |
| `components/upload-form.tsx` | 🔵 Hardening only |
| `hooks/useDocumentUpload.ts` | ⚠️ Findings |
| `lib/chunking.test.ts` | ✅ Clean |
| `lib/chunking.ts` | ✅ Clean |
| `lib/documents/provider.ts` | ⚠️ Findings |
| `lib/image-utils.ts` | ✅ Clean |
| `middleware.ts` | ⚠️ Findings |

---

## 🔴 High Severity

### H-1 — IP Spoofing Bypasses Rate Limiter
**File:** `middleware.ts` — line 15  
**OWASP:** A04 — Insecure Design

```
// 🔴 [SECURITY] The x-forwarded-for header is fully attacker-controlled.
// clientIp() trusts the first comma-separated value without any proxy validation.
// An attacker can set `x-forwarded-for: 1.2.3.4` to a fresh value on every
// request and completely bypass the 15-req/min rate limiter.
//    Fix: Only trust x-forwarded-for when behind a known, trusted reverse proxy.
//         On Vercel use `req.ip` (set by the platform). Alternatively, validate
//         proxy depth: only trust the Nth value from the right where N equals
//         the number of trusted proxies you control.
//    OWASP: A04
```

**Impact:** The sole abuse-prevention mechanism protecting `/api/documents/extract` and `/api/documents/upload` is fully defeatable with a single HTTP header, allowing unlimited OCR processing at attacker expense and enabling compute/cost exhaustion.

---

### H-2 — No Authentication on Document Upload / Extract Routes
**Files:** `app/api/documents/upload/route.ts`, `app/api/documents/extract/route.ts` (canonical handler), `middleware.ts`  
**OWASP:** A01 — Broken Access Control

```
// 🔴 [SECURITY] Neither /api/documents/upload nor /api/documents/extract
// performs any authentication or session check. The middleware only rate-limits
// by IP; it never validates a user identity. Any unauthenticated request from
// the internet can submit arbitrary files and trigger OCR processing.
//    Fix: Add a session check at the top of the POST handler (or in middleware):
//         e.g. const session = await getServerSession(authOptions);
//              if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//    OWASP: A01
```

**Impact:** Unauthenticated users can upload and OCR arbitrary files, potentially exhausting compute resources, hitting third-party OCR API quotas, or triggering sensitive document processing without authorization.

---

## 🟡 Medium Severity

### M-1 — Sensitive Document Text Written to sessionStorage
**File:** `hooks/useDocumentUpload.ts` — lines 131–139  
**OWASP:** A02 — Cryptographic Failures / Sensitive Data Exposure

```
// 🟡 [SECURITY] Full OCR text, filename, and language pair are persisted in
// sessionStorage under a predictable key `translate-${docId}`.
// sessionStorage is readable by any JavaScript running on the page, including
// third-party analytics, ads, or XSS payloads. Uploaded documents may contain
// PII, financial records, medical data, or legal materials.
//    Fix: Avoid storing full document text client-side if possible. If needed,
//         use a server-side session or encrypted client storage. At minimum
//         document the data-classification assumption so PII handling is explicit.
//    OWASP: A02
```

---

### M-2 — Raw OCR Engine Error Messages Returned to Client
**File:** `app/api/documents/extract/route.ts` — line 88  
**OWASP:** A05 — Security Misconfiguration

```
// 🟡 [SECURITY] The raw exception message from the OCR engine is forwarded
// directly to the HTTP response body via ocrFailureError(message, ...).
// OCR library errors can contain internal file paths, stack frames, binary
// offsets, or dependency version strings that aid fingerprinting.
// Example leak: "Error: ENOENT: no such file or directory, open '/tmp/ts-xxx'"
//    Fix: Log err with full detail server-side (console.error already present).
//         Return only a generic client-facing message: "OCR processing failed."
//    OWASP: A05
```

---

### M-3 — In-Memory Rate Limiter Is Per-Process; Ineffective in Serverless
**File:** `middleware.ts` — lines 3–4, 11  
**OWASP:** A04 — Insecure Design

```
// 🟡 [SECURITY] The `counters` Map is module-level in-memory state.
// In serverless/edge runtimes (Vercel Functions, AWS Lambda) each cold start
// spawns a fresh process with a zeroed counter. An attacker can intentionally
// cause cold starts or route requests to multiple instances to distribute
// requests across independent counters, making the 15-req/min limit
// far higher than intended in practice.
//    Fix: Replace the in-memory Map with a distributed atomic counter:
//         Redis (Upstash), Vercel KV, or a middleware like @upstash/ratelimit.
//    OWASP: A04
```

---

### M-4 — MockOCRProvider Is the Default in Production Code Path
**File:** `lib/documents/provider.ts` — lines 196–199  
**OWASP:** A04 — Insecure Design

```
// 🟡 [SECURITY] getOCRProvider() silently returns MockOCRProvider by default.
// MockOCRProvider.extract() returns an empty fullText for every file without
// throwing. If setOCRProvider() is never called in a deployment (e.g., env
// variable missing, startup order bug), every uploaded document is processed
// as empty text. This silent functional failure could mask a misconfiguration
// where sensitive documents appear to be processed but yield no output, or
// where business logic downstream is fed empty data without any alert.
//    Fix: Default to CompositeOCRProvider (the real provider), or throw an
//         explicit configuration error if no provider has been registered.
//         Reserve MockOCRProvider for test environments only (guard with
//         NODE_ENV check or dependency injection in tests).
//    OWASP: A04
```

---

## 🔵 Low / Hardening

### L-1 — Rate Limiter Map Is Unbounded; Memory Exhaustion Under Attack
**File:** `middleware.ts` — line 11  
**OWASP:** A05 — Security Misconfiguration

```
// 🔵 [HARDENING] The counters Map has no eviction strategy. Entries are only
// implicitly reset on the *next* request from the same IP after the window
// expires. Under a distributed attack sourcing from many unique IPs (spoofed
// or real), the Map grows without bound and can exhaust heap memory in a
// long-running Node.js server process.
//    Fix: Add a periodic cleanup sweep (e.g., setInterval evicting entries
//         where now - entry.start >= WINDOW_MS) or use an LRU-bounded Map.
//    OWASP: A05
```

---

### L-2 — File Type Enforcement Is UI-Only at the Form Layer
**File:** `components/upload-form.tsx` — lines 80–88  
**OWASP:** A04 — Insecure Design

```
// 🔵 [HARDENING] The `accept` and `maxSize` constraints in react-dropzone are
// client-side UI hints only. They can be bypassed by crafting a direct fetch()
// request or using curl. Server-side validation does exist in parseAndValidateFiles
// (extract route), so the actual risk is low — this is a defense-in-depth note.
// However, the deprecated /api/documents/upload wrapper delegates directly
// without adding its own validation layer, relying solely on the downstream
// extract handler. If that delegation ever changes, validation could be skipped.
//    Fix: Document explicitly that all file validation is enforced server-side in
//         parseAndValidateFiles. Consider adding a comment in the upload wrapper
//         route confirming the downstream handler is responsible for validation.
//    OWASP: A04
```

---

### L-3 — Silent Fire-and-Forget Failure in Chunk Embedding
**File:** `hooks/useDocumentUpload.ts` — lines 120–129  
**OWASP:** A05 — Security Misconfiguration (silent failure)

```
// 🔵 [HARDENING] Chunking and embedding are dispatched in an unawaited
// Promise.resolve().then() block. Failures are caught and written only to
// console.error, with no user notification and no telemetry signal.
// A document will silently become non-queryable for RAG without any indication.
// In a security context, silent failure suppression can obscure anomalous
// conditions (e.g., embedding service outage, malformed payload injection attempt).
//    Fix: Add an application-level error telemetry call (e.g., Sentry.captureException)
//         or surface a non-blocking toast notification to the user.
//    OWASP: A05
```

---

## Summary

```
/* ═══════════════════════════════════════════════════════════════════
   SECURITY AUDIT — commit range 09f36063..f074c1de — 2026-03-30
   Files: 8 audited (3 clean, 5 with findings)

   🔴 High:   2   (H-1: IP spoof bypasses rate limit; H-2: No auth on upload routes)
   🟡 Medium: 4   (M-1: PII in sessionStorage; M-2: OCR error leak; M-3: per-process rate limit; M-4: Mock default provider)
   🔵 Low:    3   (L-1: unbounded Map; L-2: client-only file type check; L-3: silent embedding failure)

   Priority fixes:
     1. [H-2] Add authentication check to /api/documents/extract (and upload wrapper)
     2. [H-1] Stop trusting x-forwarded-for from untrusted clients; use platform IP
     3. [M-3] Replace in-memory rate limiter with distributed KV store
     4. [M-4] Change getOCRProvider() default from MockOCRProvider to CompositeOCRProvider
   ═══════════════════════════════════════════════════════════════════ */
```
