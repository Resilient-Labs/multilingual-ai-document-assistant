# DevOps audit — Chunking and Upload Wiring scope

**Scope:** `components/upload-form.tsx`, `multilingual-ai-document-assistant/lib/chunking.ts`, `lib/entitydb.ts`, `lib/entitydb-persist.ts`, `types/index.ts`, `types/CanonicalDocument.ts`, `app/api/documents/extract/route.ts`, `hooks/useDocumentSession.ts`, `next.config.js`

**Context:** Client-side OCR for images; server extraction via upload API; stateless extract route; EntityDB (IndexedDB) on the client.

---

## Findings

```
// 🟡 [DEVOPS] Configuration / UX: Client accepts up to 10 MB (react-dropzone) while server upload uses MAX_FILE_SIZE_BYTES (4.5 MB).
//    Fix: align dropzone maxSize with lib/constants (or surface server limit in UI copy).
//    Risk: users pass client validation then hit 400 after full upload; wasted bandwidth and support noise.
//    Files: components/upload-form.tsx, lib/constants.ts (reference)
```

```
// 🟡 [DEVOPS] Resilience: PDF/doc path uses fetch("/api/documents/upload") with no AbortSignal or timeout.
//    Fix: AbortController + timeout (e.g. 60–120s for large docs) and clear user messaging on abort.
//    Risk: hung or slow networks tie up the tab and UX indefinitely; serverless/worker timeouts surface as opaque failures.
//    Files: components/upload-form.tsx
```

```
// 🟡 [DEVOPS] Observability: POST handler outer catch returns internalError without logging the underlying exception.
//    Fix: log error with request correlation id / route name (avoid logging file contents); rethrow or structured log server-side.
//    Risk: production 500s with no trail for triage.
//    Files: app/api/documents/extract/route.ts
```

```
// 🟡 [DEVOPS] Scalability / abuse: No rate limiting or payload throttling on scoped API route pattern (stateless document ingestion).
//    Fix: edge or middleware rate limits, optional auth, or WAF rules per deployment.
//    Risk: abuse and cost spikes on OCR/extraction dependencies.
//    Files: app/api/documents/extract/route.ts (and related upload route, not in scope)
```

```
// 🟡 [DEVOPS] Next.js / security headers: next.config.js has no headers() for HSTS, CSP, X-Frame-Options, etc.
//    Fix: add headers appropriate to hosting (often stricter CSP with wasm/workers for Tesseract if applicable).
//    Risk: baseline hardening gaps vs security checklist expectations.
//    Files: next.config.js
```

```
// 🟡 [DEVOPS] Performance / scalability: useDocumentSession and getDocumentFromEntityDB load all "vectors" records via getAll() then filter.
//    Fix: indexed query by docId/entityKey if IDB schema allows; or maintain a side index store.
//    Risk: latency and main-thread cost grow linearly with stored documents.
//    Files: hooks/useDocumentSession.ts, lib/entitydb-persist.ts
```

```
// 🔵 [DEVOPS] Observability: OCR failure uses console.error with raw err — not structured JSON; log level not explicit.
//    Fix: use a logger with level + JSON fields (route, documentId, filename, error.code).
//    Risk: harder log aggregation and alerting in production platforms.
//    Files: app/api/documents/extract/route.ts
```

```
// 🔵 [DEVOPS] Resilience: Client assumes JSON body on upload response (await res.json() before checking res.ok path ordering is ok, but non-JSON error bodies throw).
//    Fix: check Content-Type or try/catch JSON parse with fallback message.
//    Risk: misleading errors when proxies return HTML.
//    Files: components/upload-form.tsx
```

```
// 🔵 [DEVOPS] Deployment / consistency: Documentation and plan cite POST /api/documents/extract; upload form calls /api/documents/upload for non-images.
//    Fix: converge on one contract or document why two endpoints exist and when each is used.
//    Risk: integration mistakes and duplicated operational playbooks.
//    Files: components/upload-form.tsx vs app/api/documents/extract/route.ts
```

```
// 🔵 [DEVOPS] Maintainability: entitydb-persist and useDocumentSession rely on EntityDB internal dbPromise cast to raw IDB.
//    Fix: upstream feature request or wrapper abstraction with version pin tests.
//    Risk: silent breakage on @babycommando/entity-db upgrades.
//    Files: lib/entitydb-persist.ts, hooks/useDocumentSession.ts
```

```
// 🔵 [DEVOPS] Storage footprint: Persisting imageDataUrl (base64) inside IndexedDB records increases store size and parse cost.
//    Fix: store blob URLs or object URLs with lifecycle rules, or omit for large files.
//    Risk: quota pressure and slow reads on constrained devices.
//    Files: lib/entitydb-persist.ts
```

---

## Per-file notes (no issues beyond above)

- **multilingual-ai-document-assistant/lib/chunking.ts** — Pure CPU-bound splitting; no I/O, timeouts, or deployment coupling. Token count is heuristic (`length/4`); operational impact only if used for billing or limits elsewhere.
- **lib/entitydb.ts** — Singleton pattern appropriate for browser; VECTOR_PATH and EMBEDDING_MODEL are compile-time constants (not env-driven); acceptable for client-only assistant, note if multi-tenant or model switching is required later.
- **types/index.ts**, **types/CanonicalDocument.ts** — Type contracts only; no runtime DevOps concerns.

---

```
/* ═══════════════════════════════════════════
   DEVOPS AUDIT — Chunking and Upload Wiring scope — 2026-03-27T14:30:00Z
   🔴 High: 0  🟡 Medium: 6  🔵 Low: 5
   ═══════════════════════════════════════════ */
```
