# Consolidated Audit Report

**Date:** 2026-03-23  
**Scope:** Chunking Pipeline + Upload Wiring (15 files)  
**Timestamp Key:** 2026-03-23-1558

---

## 1. Executive Summary

| Role | High | Medium | Low | Status |
|------|------|--------|-----|--------|
| Principal Engineer | 2 | 10 | 0 | 🔴 critical |
| Security Auditor | 1 | 2 | 3 | 🔴 critical |
| DevOps Engineer | 2 | 4 | 3 | 🔴 critical |
| Accessibility Auditor | 1 | 3 | 3 | 🟡 warn |
| Patterns Auditor | 0 | 4 | 9 | 🟡 warn |
| **TOTAL** | **6** | **23** | **18** | **🔴 critical** |

---

## 2. Top Action Items

### 1. Fix Client/Server Contract Mismatch (High — Principal H1, DevOps H1, Security SEC-5, Patterns DRY-3)
The upload form accepts DOC/DOCX/TXT/HEIC and allows 10 MB, but the server only accepts PDF/JPEG/PNG/WebP and enforces 4.5 MB. Users hit silent 400 errors. Import `MAX_FILE_SIZE_BYTES` and `ALLOWED_MIME_TYPES` from `lib/constants.ts` into the upload form.

### 2. Add Authentication to API Routes (High — Security SEC-1)
All three API route handlers (`/api/documents/extract`, `/api/documents/upload`, `/api/upload`) accept unauthenticated POST requests. The OCR endpoint is computationally expensive and publicly accessible. Add session checks or API key validation.

### 3. Wire Language Selection or Remove Dead UI (High — Principal H2)
Source/target language dropdowns are rendered but never sent to the API. Users select languages that are silently discarded. Either wire into FormData and propagate through the pipeline, or remove until ready.

### 4. Add Observability to Extract Route (High — DevOps H2)
The outer catch in `/api/documents/extract` swallows errors with no logging. Production 500s and OCR failures are invisible. Add structured logging with correlation IDs.

### 5. Add Rate Limiting and Timeouts (Medium — Security SEC-3, DevOps M1/M2)
No rate limiting on extraction endpoints (up to 10 files × 4.5 MB per request). No timeouts on fetch or OCR calls. Add per-IP rate limiting and AbortSignal deadlines.

---

## 3. Per-Role Findings

### Principal Engineer (2 High, 10 Medium)
| ID | Severity | Finding |
|----|----------|---------|
| H1 | 🔴 | Client/server contract mismatch: MIME types and file size limits diverge |
| H2 | 🔴 | Language selection UI is non-functional (dead feature) |
| M1 | 🟡 | Near-God component: `upload-form.tsx` mixes 6+ responsibilities (330 lines) |
| M2 | 🟡 | Three overlapping upload routes — two are dead code |
| M3 | 🟡 | Sequential chunk insertion blocks UI thread |
| M4 | 🟡 | Chunking page-boundary drops overlap context (RAG gap) |
| M5 | 🟡 | `alert()` for error handling (poor UX) |
| M6 | 🟡 | Duplicate field candidates from overlapping pattern matchers |
| M7 | 🟡 | No entity key on chunk inserts |
| M8 | 🟡 | OCR provider hardcoded to mock — no env-based selection |
| M9 | 🟡 | Partial write risk in submission flow (no transaction/retry safety) |
| M10 | 🟡 | `fallbackChunkFullText` excessive nesting / duplicated buffer logic |

### Security Auditor (1 High, 2 Medium, 3 Hardening)
| ID | Severity | Finding | OWASP |
|----|----------|---------|-------|
| SEC-1 | 🔴 | No authentication on any API route | A01 |
| SEC-2 | 🟡 | MIME type validation relies on client-provided `file.type` (spoofable) | A04 |
| SEC-3 | 🟡 | No rate limiting on extraction endpoints | A04 |
| SEC-4 | 🔵 | Stub endpoint returns success for any request | A05 |
| SEC-5 | 🔵 | Client accepts broader file types than server allows | A04 |
| SEC-6 | 🔵 | Uploaded filename reflected in responses without sanitization | A03 |

### DevOps Engineer (2 High, 4 Medium, 3 Low)
| ID | Severity | Finding |
|----|----------|---------|
| D-H1 | 🔴 | Client/server contract mismatch (size + MIME) |
| D-H2 | 🔴 | Extract route outer catch drops errors with no logging |
| D-M1 | 🟡 | No timeouts on fetch or OCR calls |
| D-M2 | 🟡 | No rate limiting or concurrency control |
| D-M3 | 🟡 | Full-buffer reads and sequential OCR processing |
| D-M4 | 🟡 | Stub `/api/upload` route misleads in production |
| D-L1 | 🔵 | Limits and tunables not env-driven |
| D-L2 | 🔵 | No structured logging or correlation IDs |
| D-L3 | 🔵 | MockOCRProvider ships PII-shaped sample data |

### Accessibility Auditor (1 High, 3 Medium, 3 Low)
| ID | Severity | Finding | WCAG |
|----|----------|---------|------|
| A-H1 | 🔴 | Nested interactive elements — buttons inside dropzone `role="button"` | 4.1.2 |
| A-M1 | 🟡 | Errors surfaced only with `alert()` — no in-page status pattern | 3.3.1 |
| A-M2 | 🟡 | "Translation direction" heading not grouped with controls | 1.3.1 |
| A-M3 | 🟡 | Submit loading state not announced — no `aria-busy` or live region | 3.3.2 |
| A-L1 | 🔵 | Decorative icons missing `aria-hidden="true"` | 1.1.1 |
| A-L2 | 🔵 | Dropzone lacks accessible name with accepted types | 1.3.1 |
| A-L3 | 🔵 | SelectItem focus/contrast needs verification | 2.4.7 |

### Patterns Auditor (0 High, 4 Medium, 9 Low)
| ID | Severity | Finding |
|----|----------|---------|
| P-M1 | 🟡 | Parallel upload validation: `documents/upload` duplicates `parseAndValidateFiles` |
| P-M2 | 🟡 | Triplicated user-facing validation copy ("Allowed: PDF, JPEG, PNG, WebP") |
| P-M3 | 🟡 | Client/server limits and allowlists diverge (duplicate rules) |
| P-M4 | 🟡 | Two document POST pipelines with different shapes |
| P-L1 | 🔵 | Chunking buffer emit/overlap pattern repeated 3x — extract helper |
| P-L2 | 🔵 | Buffer growth `buffer ? buffer + " " + piece : piece` repeated |
| P-L3 | 🔵 | Custom hook opportunity: `useDocumentExtractionFlow` |
| P-L4 | 🔵 | Component extraction: mobile/desktop dropzone duplication |
| P-L5 | 🔵 | Field candidate builder scaffolding repeated 5x |
| P-L6 | 🔵 | ID generation pattern duplicated — consolidate to `lib/ids.ts` |
| P-L7 | 🔵 | Extract route error switch → map-based dispatch |
| P-L8 | 🔵 | LANGUAGES constant should move to shared config |
| P-L9 | 🔵 | Stub `/api/upload` route consolidation |

---

## 4. Files Needing Immediate Attention

| File | Issues | Roles |
|------|--------|-------|
| `components/upload-form.tsx` | Contract mismatch, dead language UI, God component, `alert()` errors, sequential inserts, nested interactives, no aria-busy | Principal, Security, DevOps, A11y, Patterns |
| `app/api/documents/extract/route.ts` | No auth, no rate limit, no timeout, error swallowing | Security, DevOps |
| `lib/constants.ts` | Misaligned with client; not env-driven | Principal, DevOps, Patterns |
| `app/api/documents/upload/route.ts` | Dead code, duplicate validation, no auth | Principal, Security, Patterns |
| `app/api/upload/route.ts` | Stub endpoint, no auth, misleading response | Security, DevOps, Patterns |
| `lib/chunking.ts` | Page-boundary overlap gap, duplicated buffer pattern | Principal, Patterns |
| `lib/documents/provider.ts` | Hardcoded mock, no env-based selection | Principal, DevOps |
| `lib/documents/fieldCandidates.ts` | Duplicate candidates, repeated scaffolding | Principal, Patterns |

---

## 5. Model Tiers Used

| Role | Model Tier |
|------|-----------|
| Principal Engineer | default |
| Security Auditor | default |
| DevOps Engineer | fast |
| Accessibility Auditor | fast |
| Patterns Auditor | fast |

---

## 6. Worker Execution Summary

| Batch | Workers | Roles |
|-------|---------|-------|
| Batch 1 (parallel) | 4 | Principal, Security, DevOps, A11y |
| Batch 2 (parallel) | 1 | Patterns |
| **Total** | **5** | |

---

## Individual Reports

- [Principal Engineer](../individual/principal.md)
- [Security Auditor](../individual/security.md)
- [DevOps Engineer](../individual/devops.md)
- [Accessibility Auditor](../individual/a11y.md)
- [Patterns Auditor](../individual/patterns.md)
