# Consolidated Audit Report — Chunking & Upload Wiring

**Date:** 2026-03-27 14:30  
**Scope:** Files related to the "Chunking and Upload Wiring" plan  
**Roles:** Principal Engineer, Security Auditor, DevOps Engineer, Accessibility Auditor, Patterns Auditor

---

## Executive Summary

| Role | High | Medium | Low | Status |
|------|------|--------|-----|--------|
| Principal Engineer | 4 | 5 | 2 | 🔴 Critical |
| Security Auditor | 1 | 4 | 4 | 🟡 Warn |
| DevOps Engineer | 0 | 6 | 5 | 🟡 Warn |
| Accessibility Auditor | 1 | 4 | 3 | 🟡 Warn |
| Patterns Auditor | 1 | 4 | 6 | 🟡 Warn |
| **Totals** | **7** | **23** | **20** | **🔴 Critical** |

---

## Top 5 Action Items

1. **Move and wire `lib/chunking.ts`** — The chunking file is orphaned at `multilingual-ai-document-assistant/lib/chunking.ts` and nothing imports it. The RAG pipeline is completely unwired. Move to `lib/chunking.ts`, call `chunkText()` during persistence, and store chunks with real embeddings instead of placeholder vectors. *(Principal H1, H2; Patterns L1)*

2. **Add rate limiting to extraction endpoints** — Both `/api/documents/upload` and `/api/documents/extract` are public, unauthenticated, CPU-intensive endpoints with no rate limiting. Add middleware-level rate limits. *(Security HIGH-1; DevOps M4)*

3. **Align file size limits** — Client dropzone accepts 10 MB but server rejects at 4.5 MB. Import a shared constant and update UI copy. *(Security MED-4; DevOps M1; Patterns H1)*

4. **Add `role="alert"` to error messages** — Dynamic error text in the upload form is not announced to screen readers. Add `role="alert"` or `aria-live="assertive"` on the error container. *(A11y HIGH-1)*

5. **Consolidate duplicated EntityDB internal access** — `EntityDBInternal` interface and IDB access pattern are copy-pasted across `lib/entitydb-persist.ts` and `hooks/useDocumentSession.ts`. Extract into shared module. *(Principal M1; Patterns M1, M2)*

---

## Per-Role Findings

### Principal Engineer

| ID | Severity | Finding |
|----|----------|---------|
| H1 | 🔴 High | `chunking.ts` is orphaned at wrong path; nothing imports it; RAG chunking pipeline is unwired |
| H2 | 🔴 High | Placeholder vectors bypass embedding pipeline — semantic search returns meaningless results |
| H3 | 🔴 High | `upload-form.tsx` is a God component (430+ lines, 6+ responsibilities) |
| H4 | 🔴 High | Two overlapping extraction API routes (`/upload` vs `/extract`) with unclear ownership |
| M1 | 🟡 Medium | Duplicated `EntityDBInternal` interface and IDB access pattern |
| M2 | 🟡 Medium | Dual-storage anti-pattern (`sessionStorage` + EntityDB) — two sources of truth |
| M3 | 🟡 Medium | Unsafe `as unknown as` casts for EntityDB internals |
| M4 | 🟡 Medium | No error recovery for IndexedDB write failures |
| M5 | 🟡 Medium | Tesseract OCR confidence values discarded (hardcoded to 1.0) |
| L1 | 🔵 Low | `logDocumentSubmission` fires before file null-check |
| L2 | 🔵 Low | `next.config.js` silently disables `onnxruntime-node` and `sharp` |

### Security Auditor

| ID | Severity | OWASP | Finding |
|----|----------|-------|---------|
| HIGH-1 | 🔴 High | A04 | No rate limiting on CPU-intensive extraction endpoints |
| MED-1 | 🟡 Medium | A04/A01 | Server action writes unbounded user input to disk |
| MED-2 | 🟡 Medium | A04 | MIME type validation trusts client-supplied headers |
| MED-3 | 🟡 Medium | A05 | No HTTP security headers configured |
| MED-4 | 🟡 Medium | A04 | Client/server file size limit mismatch (10 MB vs 4.5 MB) |
| LOW-1 | 🔵 Low | A09 | Server error logging may leak sensitive context |
| LOW-2 | 🔵 Low | A09 | Hardcoded request ID defeats audit trail |
| LOW-3 | 🔵 Low | A01 | No CSRF protection on stateless API routes |
| LOW-4 | 🔵 Low | A04 | Unbounded IndexedDB `getAll()` reads |

### DevOps Engineer

| ID | Severity | Finding |
|----|----------|---------|
| M1 | 🟡 Medium | Client accepts 10 MB; server rejects at 4.5 MB |
| M2 | 🟡 Medium | Upload `fetch` has no AbortSignal or timeout |
| M3 | 🟡 Medium | Extract route outer catch swallows error without logging |
| M4 | 🟡 Medium | No rate limiting or payload throttling on extraction endpoints |
| M5 | 🟡 Medium | `next.config.js` missing security headers |
| M6 | 🟡 Medium | `getAll()` scans scale linearly with stored documents |
| L1 | 🔵 Low | OCR failure log not structured JSON |
| L2 | 🔵 Low | Client assumes JSON on upload response without checking Content-Type |
| L3 | 🔵 Low | `/api/documents/extract` vs `/api/documents/upload` route divergence |
| L4 | 🔵 Low | `dbPromise` cast coupling to EntityDB internals |
| L5 | 🔵 Low | `imageDataUrl` base64 in IndexedDB increases storage pressure |

### Accessibility Auditor (WCAG 2.1 AA)

| ID | Severity | WCAG | Finding |
|----|----------|------|---------|
| H1 | 🔴 High | 4.1.3 | Error messages not exposed via `role="alert"` or `aria-live` |
| M1 | 🟡 Medium | 1.3.1 / 4.1.2 | Source/target selects not programmatically distinguishable |
| M2 | 🟡 Medium | 3.3.1 / 4.1.3 | OCR progress not announced to screen readers |
| M3 | 🟡 Medium | 2.1.1 / 2.4.3 | Mobile: nested focusable button inside dropzone creates double tab stop |
| M4 | 🟡 Medium | 2.1.1 | Dropzone keyboard activation needs verification per react-dropzone version |
| L1 | 🔵 Low | 1.1.1 | Decorative icons lack `aria-hidden="true"` |
| L2 | 🔵 Low | 1.3.1 | "Translation direction" should be a `<fieldset>`/`<legend>` |
| L3 | 🔵 Low | 3.3.2 | File input lacks `aria-describedby` for accepted types/size |

### Patterns / DRY Auditor

| ID | Severity | Finding |
|----|----------|---------|
| H1 | 🔴 High | File size constants diverge (dropzone 10 MB vs server 4.5 MB) |
| M1 | 🟡 Medium | Duplicated `EntityDBInternal` + IDB read/write patterns across two files |
| M2 | 🟡 Medium | Same `"extracted_document"` key defined as two separate constants |
| M3 | 🟡 Medium | Single-block OCRResult construction repeated in upload form + upload route |
| M4 | 🟡 Medium | Two server extraction surfaces (`/extract` vs `/upload`) with overlapping logic |
| L1 | 🔵 Low | `chunkText` unused; file at wrong path |
| L2 | 🔵 Low | `useDocumentSession` should delegate to `getDocumentFromEntityDB` |
| L3 | 🔵 Low | Hardcoded API path string |
| L4 | 🔵 Low | Mobile/desktop dropzone JSX duplication (~60 lines each) |
| L5 | 🔵 Low | Chunking defaults not aligned with shared config |
| L6 | 🔵 Low | Embedding model + dimension constants split across files |

---

## Files Needing Immediate Attention

| File | Issues | Roles Flagging |
|------|--------|----------------|
| `components/upload-form.tsx` | God component, dual storage, OCR confidence lost, no fetch timeout, a11y violations, DRY mobile/desktop | Principal, DevOps, A11y, Patterns |
| `lib/entitydb-persist.ts` | Placeholder vectors, unsafe casts, no error recovery, duplicated IDB access | Principal, Security, DevOps, Patterns |
| `hooks/useDocumentSession.ts` | Duplicated IDB access, `getAll()` scaling, duplicated entity key constant | Principal, Security, DevOps, Patterns |
| `multilingual-ai-document-assistant/lib/chunking.ts` | Wrong path, unused, not wired into pipeline | Principal, Patterns |
| `app/api/documents/extract/route.ts` | No rate limiting, swallowed errors, unused by upload form | Security, DevOps, Patterns |
| `app/api/documents/upload/route.ts` | No rate limiting, size mismatch, overlaps with extract | Security, DevOps, Patterns |
| `next.config.js` | No security headers | Security, DevOps |

---

## Model Tiers Used

| Role | Model Tier |
|------|-----------|
| Principal Engineer | default |
| Security Auditor | default |
| DevOps Engineer | fast |
| Accessibility Auditor | fast |
| Patterns Auditor | fast |

## Worker Execution Summary

- **Batch 1 (4 concurrent):** Principal, Security, DevOps, A11y
- **Batch 2 (1):** Patterns
- **Total workers spawned:** 5

---

## Individual Reports

- [`audit-reports/AUDIT-2026-03-27-1430/individual/principal.md`](../individual/principal.md)
- [`audit-reports/AUDIT-2026-03-27-1430/individual/security.md`](../individual/security.md)
- [`audit-reports/AUDIT-2026-03-27-1430/individual/devops.md`](../individual/devops.md)
- [`audit-reports/AUDIT-2026-03-27-1430/individual/a11y.md`](../individual/a11y.md)
- [`audit-reports/AUDIT-2026-03-27-1430/individual/patterns.md`](../individual/patterns.md)
