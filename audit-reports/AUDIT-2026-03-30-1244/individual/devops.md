# DevOps audit — commit range `09f3606..f074c1d`

Scope: `app/api/documents/upload/route.ts`, `components/upload-form.tsx`, `hooks/useDocumentUpload.ts`, `lib/chunking.test.ts`, `lib/chunking.ts`, `lib/documents/provider.ts`, `lib/image-utils.ts`, `middleware.ts`

Role checklist: observability, resilience, configuration, scalability, deployment hygiene, Next.js-specific (where applicable).

---

## `app/api/documents/upload/route.ts`

```
// 🟡 [DEVOPS] Observability: Deprecation is logged with console.warn as a plain string, not structured JSON.
//    Fix: use a logger with level, route name, and request correlation id when available.
//    Risk: harder to filter/alert in log aggregators; no standard fields for dashboards.
```

```
// 🔵 [DEVOPS] Resilience: No explicit error boundary around extractHandler delegation.
//    Fix: optional try/catch to attach route context before rethrowing or mapping to 502.
//    Risk: low if extract route already normalizes errors; adds clarity for this shim.
```

---

## `components/upload-form.tsx`

```
// ✅ DevOps Audit — No material production-ops issues in this file (presentational client UI).
//    Client-side max size aligns with MAX_FILE_SIZE_BYTES; no server logging or external I/O here.
```

---

## `hooks/useDocumentUpload.ts`

```
// 🟡 [DEVOPS] Resilience: fetch("/api/documents/upload") has no AbortSignal or timeout.
//    Fix: AbortController + setTimeout to abort; surface timeout to the user.
//    Risk: hung or slow API ties up the tab until browser defaults apply; poor UX under upstream slowness.
```

```
// 🟡 [DEVOPS] Observability & resilience: logDocumentSubmission(...).catch(() => {}) drops failures silently.
//    Fix: log to your telemetry path or at least console.warn with context in development.
//    Risk: missing signals when audit/analytics pipeline fails.
```

```
// 🟡 [DEVOPS] Scalability: Chunking and insertChunk run in a fire-and-forget Promise after navigation.
//    Fix: await in critical path, queue (worker), or report failures to the user / retry with backoff.
//    Risk: embeddings incomplete while user sees success; only console.error("[chunking]...") on failure.
```

```
// 🟡 [DEVOPS] Performance: Non-image path buffers the full file in FormData; image path loads full file into memory for OCR.
//    Fix: acceptable for bounded MAX_FILE_SIZE; document streaming only if limits grow materially.
//    Risk: memory pressure on low-end clients with large allowed files.
```

```
// 🔵 [DEVOPS] Resilience: Client-side Tesseract is CPU-heavy; no cancellation if user leaves mid-job.
//    Fix: AbortController tied to component unmount and worker.terminate().
//    Risk: wasted work and possible memory leaks on fast navigation.
```

---

## `lib/chunking.ts` / `lib/chunking.test.ts`

```
// 🔵 [DEVOPS] Scalability / cost signals: tokenCount uses length/4 heuristic, not a real tokenizer.
//    Fix: if used for billing or hard limits, align with the embedding model’s tokenizer.
//    Risk: mismatched capacity planning or quota enforcement.
```

```
// ✅ Tests: chunking.test.ts improves regression safety for RAG chunk boundaries; no runtime ops concerns.
```

---

## `lib/documents/provider.ts`

```
// 🔴 [DEVOPS] Configuration / production readiness: getOCRProvider() lazily constructs MockOCRProvider when unset.
//    Fix: default to CompositeOCRProvider (or wire via env-driven factory) at module load or instrumentation; fail fast if misconfigured.
//    Risk: /api/documents/extract (and thus deprecated upload for documents) returns empty OCR in production unless something external calls setOCRProvider — no app usage of setOCRProvider found outside tests.
```

```
// 🟡 [DEVOPS] Resilience: Tesseract worker.recognize and DocumentTextProvider paths (unpdf, mammoth, word-extractor) have no explicit timeout.
//    Fix: wrap with Promise.race against a timeout and map to OCR_FAILURE.
//    Risk: single large or pathological file blocks the serverless invocation or thread for a long time.
```

```
// 🔵 [DEVOPS] Deployment: Module-level _provider singleton persists for the lifetime of a Node process.
//    Fix: document expected behavior for multi-tenant tests; reset in tests only (already present).
//    Risk: low; mainly relevant if hot-reloading or tests leak state across suites.
```

---

## `lib/image-utils.ts`

```
// 🟡 [DEVOPS] Performance: HEIC path reads the full file into memory twice (slice for header + arrayBuffer for decode).
//    Fix: reuse one ArrayBuffer where possible.
//    Risk: doubled peak memory on large HEIC uploads within client limits.
```

```
// 🔵 [DEVOPS] Resilience: libheif decode / canvas.toBlob have no timeout.
//    Fix: optional watchdog for pathological images.
//    Risk: rare hangs on corrupt HEIC; browser-dependent.
```

---

## `middleware.ts`

```
// 🟡 [DEVOPS] Scalability: Rate limiting uses an in-memory Map per Edge/Node instance.
//    Fix: Redis or edge KV (e.g. Vercel KV, Upstash) for distributed counts; or accept limitation in single-instance deploys.
//    Risk: under horizontal scaling, effective rate limit is MAX_REQUESTS × replica count; uneven traffic bypasses intent.
```

```
// 🟡 [DEVOPS] Security / fairness: clientIp falls back to "unknown" when headers absent; all such clients share one bucket.
//    Fix: require trusted proxy config and structured deny vs bucket-by-connection id where IP unknown.
//    Risk: one noisy "unknown" client can deny others; or bucket is too permissive if spoofed X-Forwarded-For is trusted without proxy validation.
```

```
// 🔵 [DEVOPS] Observability: 429 responses are not logged with structured fields (ip hash, route, count).
//    Fix: emit metric or JSON log line on limit hit for SLO dashboards.
//    Risk: harder to tune limits or detect abuse patterns.
```

```
// 🔵 [DEVOPS] Product ops: MAX_REQUESTS=15 per minute may be tight for power users batching uploads.
//    Fix: monitor 429 rate; tier limits by auth if added later.
//    Risk: false-positive throttling, not outage-level.
```

---

## Out of scope (checklist items not verifiable from these files alone)

- Dockerfile user/base image pin, migrations-on-boot, `/health` endpoint, env schema at startup, `next.config` security headers — require other repository paths; not assessed here.

---

/* ═══════════════════════════════════════════
   DEVOPS AUDIT — scoped files — 2026-03-30T12:44Z
   🔴 High: 1  🟡 Medium: 9  🔵 Low: 7
   ═══════════════════════════════════════════ */
