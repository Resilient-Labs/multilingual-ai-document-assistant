# DevOps audit — Chunking pipeline + upload wiring

**Scope:** `lib/chunking.ts`, `components/upload-form.tsx`, `app/api/documents/extract/route.ts`, `app/api/documents/upload/route.ts`, `app/api/upload/route.ts`, `lib/entitydb.ts`, `lib/constants.ts`, `lib/documents/*`, `types/index.ts`, `types/CanonicalDocument.ts`  
**Role:** DevOps / platform reliability (observability, resilience, config, scalability, deployment hygiene)

---

## Findings

```
// 🔴 [DEVOPS] Contract mismatch: Client accepts up to 10 MB and MIME types (DOC, DOCX, TXT, broad image/*) while server validates against MAX_FILE_SIZE_BYTES (4.5 MB) and ALLOWED_MIME_TYPES (PDF + JPEG/PNG/WebP only).
//    Fix: drive max size and allowlist from one shared module or env; align react-dropzone maxSize/accept with parseAndValidateFiles.
//    Risk: Predictable 400s, confused users, and support load despite “valid” client selection.

// 🔴 [DEVOPS] Observability: POST /api/documents/extract uses empty catch and returns generic internalError with no server-side logging or error identity.
//    Fix: log structured error (code, documentId if known, sanitized filename) with a request/correlation id; avoid logging raw file bytes or full OCR text.
//    Risk: Production 500s and OCR failures are invisible in logs; no way to triage incidents or measure SLOs.

// 🟡 [DEVOPS] Resilience: Browser fetch to /api/documents/extract and ocrProvider.extract() have no explicit timeout or abort; large/slow OCR can hold connections and memory until platform limits.
//    Fix: AbortSignal with deadline on fetch; timeout wrapper or vendor timeouts around OCR.
//    Risk: Hung requests, connection pool exhaustion, poor UX under upstream slowness.

// 🟡 [DEVOPS] Scalability / abuse: No rate limiting, body size guard beyond per-file validation, or concurrency control visible on the extraction route.
//    Fix: edge or middleware rate limits, optional global request size cap, consider queue for heavy OCR in production.
//    Risk: Cost spikes and DoS-shaped traffic against stateless but CPU-heavy OCR.

// 🟡 [DEVOPS] Performance: Each validated file is fully read into memory via arrayBuffer(); OCR runs sequentially in a for-loop; client runs sequential insertChunk calls (each likely embedding).
//    Fix: stream where the OCR API allows; parallelize safe OCR calls with a cap; batch or background chunk persistence to avoid blocking navigation.
//    Risk: Latency and memory spikes for multi-file or large documents; main-thread jank on the client.

// 🟡 [DEVOPS] Deployment hygiene: app/api/upload/route.ts returns { success: true } as a stub while TODO remains.
//    Fix: return 501/404, remove route, or implement and secure consistently with /api/documents/extract.
//    Risk: False-positive health checks or accidental coupling if something calls this path in production.

// 🔵 [DEVOPS] Configuration: Limits (MAX_FILE_SIZE_BYTES, MAX_FILES_PER_REQUEST), chunk sizes (CHUNK_TARGET_SIZE / OVERLAP), EntityDB vectorPath/model are compile-time constants, not env with startup validation.
//    Fix: centralize tunables in env + schema (e.g. zod) so staging/prod differ without rebuilds.
//    Risk: Slower iteration and harder incident response (redeploy to change limits).

// 🔵 [DEVOPS] Logging: No structured JSON logs, levels, or correlation IDs in the audited server paths; client uses alert() only.
//    Fix: adopt a server logger with JSON output in route handlers; optional client telemetry for failed extraction (without PII).
//    Risk: Harder log aggregation, alerting, and dashboards in production platforms.

// 🔵 [DEVOPS] MockOCRProvider: Synthetic content includes person-like sample fields; if this provider ships in production, responses carry placeholder PII-shaped strings.
//    Fix: gate mock provider behind explicit NODE_ENV or feature flag; ensure production provider is configured via env.
//    Risk: Misleading demos in prod data paths and possible compliance questions if logs/store capture that text.
```

---

## Per-file notes (brief)

| Area | Note |
|------|------|
| `chunking.ts` | Pure CPU; no I/O. Chunk sizing not externally tunable. |
| `upload-form.tsx` | No fetch timeout/abort; sequential DB writes after extract. |
| `extract/route.ts` | Good validation branching; weak outer error visibility. |
| `documents/upload/route.ts` | Placeholder OCR; catch without logging. |
| `api/upload/route.ts` | Stub endpoint. |
| `entitydb.ts` | Singleton client DB; model/path fixed. |
| `constants.ts` | Single source for server limits; not aligned with UI. |
| `documents/*` | Solid types and error shapes; provider selection not env-driven. |
| `types/*` | Contracts only; no runtime ops impact. |

---

```
/* ═══════════════════════════════════════════
   DEVOPS AUDIT — chunking-upload-scope 2026-03-23
   🔴 High: 2  🟡 Medium: 4  🔵 Low: 3
   ═══════════════════════════════════════════ */
```
