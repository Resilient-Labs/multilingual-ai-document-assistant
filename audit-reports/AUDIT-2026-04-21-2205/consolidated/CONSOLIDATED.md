# Full Audit — Consolidated Report

**Date:** 2026-04-21 22:05  
**Scope:** `lib/guardrails/` (11 files) · `app/api/translate/route.ts` · `app/api/tts/route.ts`  
**Implementation:** LLM Guardrails — 5-Layer Defense for Translate and TTS Routes  
**Workers spawned:** 5 (2 batches) | **Model tiers:** principal=default, security=default, devops=fast, a11y=fast, patterns=fast

---

## Executive Summary Table

| Role | High | Medium | Low | Status |
|------|------|--------|-----|--------|
| Principal Engineer | 2 | 14 | 6 | 🔴 Critical |
| Security Auditor | 2 | 6 | 7 | 🔴 Critical |
| DevOps Engineer | 4 | 4 | 4 | 🔴 Critical |
| Accessibility Auditor | 0 | 3 | 4 | 🟡 Warn |
| Patterns Auditor | 0 | 4 | 7 | 🟡 Warn |
| **Totals** | **8** | **31** | **28** | **🔴 Critical** |

> **Note:** Findings overlap across roles (e.g. missing rate limiting flagged by both Security and DevOps). Unique issue count is lower; see deduplication in the action items below.

---

## Top 5 Action Items (Must Fix)

### 1. 🔴 No Authentication or Rate Limiting on Public Endpoints
**Roles:** Security (HIGH-1, HIGH-2) · DevOps (HIGH)  
**Files:** `app/api/translate/route.ts`, `app/api/tts/route.ts`

Both `/api/translate` and `/api/tts` are completely unauthenticated. Any anonymous caller can invoke them and exhaust paid external API quotas (DeepL character budget, HF Space compute). There is zero rate limiting — a single bot can send thousands of 50,000-character requests per minute.

**Fix:** Add Next.js middleware with session/JWT auth check. Add per-IP rate limiting via Upstash Ratelimit or Vercel's built-in edge rate limiting (e.g. 60 req/min translate, 30 req/min TTS). Add `Retry-After` header on 429 responses.

---

### 2. 🔴 No Fetch Timeouts on External API Calls
**Role:** DevOps (HIGH × 2)  
**Files:** `app/api/translate/route.ts` line 66, `app/api/tts/route.ts` line 53

`fetch('https://api-free.deepl.com/v2/translate', ...)` and `synthesizeSpeech(...)` have no `AbortController` timeout. If DeepL is slow or HF Space is cold-starting (can take 30–60 s), the serverless function hangs open, consuming the slot indefinitely.

**Fix:**
```typescript
const controller = new AbortController()
const id = setTimeout(() => controller.abort(), 8_000)
try {
  const res = await fetch(url, { signal: controller.signal, ...opts })
} finally { clearTimeout(id) }
```
For TTS, thread the signal through `synthesizeSpeech` and its underlying fetch.

---

### 3. 🔴 In-Memory Circuit Breaker Is Ineffective in Serverless
**Roles:** DevOps (HIGH) · Security (HARDENING-5) · Principal (HIGH)  
**File:** `lib/guardrails/circuit-breaker.ts`

The module-level `registry` Map is wiped on every serverless cold-start. The breaker will almost never accumulate enough consecutive failures to trip in production because Vercel creates fresh Node.js processes concurrently. The HALF_OPEN state additionally allows all concurrent requests through simultaneously instead of exactly one probe, creating a thundering-herd on recovering upstreams.

**Fix (short-term):** Document the per-container limitation; lower `failureThreshold` to 2 and `cooldownMs` to 30 s.  
**Fix (production):** Persist state in Vercel KV or Upstash Redis with atomic increment. Fix HALF_OPEN with a `probeInFlight: boolean` flag.

---

### 4. 🔴 PII Passport Regex Causes Extreme False Positives
**Roles:** Principal (HIGH) · Security (HARDENING-2)  
**File:** `lib/guardrails/pii.ts` line 64

`/\b[A-Z]{1,2}\d{6,9}\b/` matches product model numbers, version codes, order references, tracking IDs, and countless legitimate document fragments. Any user submitting technical or commercial content will be blocked with `PII_DETECTED`, making the translate and TTS routes unusable for large categories of valid input.

**Fix:** Require keyword anchoring: `/(passport|pass\s*no\.?|ppt)\s*[:=]?\s*[A-Z]{1,2}\d{6,9}/i` — analogous to the existing `bank_account` and `drivers_license` patterns which already do this correctly. The SSN pattern (any 9-digit sequence) has the same problem and should require at least one explicit delimiter.

---

### 5. 🔴 Injection Detection Internals Exposed in Error Responses
**Role:** Security (MEDIUM-5)  
**File:** `lib/guardrails/domain.ts`

When injection or content-policy checks fire, the error response includes:
```json
{ "details": { "detectedTypes": [{ "type": "ignore-instructions", "label": "..." }] } }
```
This tells an attacker exactly which pattern triggered the block. They can iterate until they find payloads that avoid all listed types — directly undermining the injection-detection layer.

**Fix:** Replace `detectedTypes` with a generic count (`detectedCount: 2`) or remove `details` entirely on `INJECTION_DETECTED` / `CONTENT_POLICY_VIOLATION` responses. Server-side logs retain the full detail.

---

## Per-Role Findings Summary

### Principal Engineer — 2 High · 14 Medium · 6 Low

| # | File | Severity | Finding |
|---|------|----------|---------|
| 1 | `pii.ts` | 🔴 HIGH | Passport regex fires on model numbers/version codes — extreme false positives |
| 2 | `circuit-breaker.ts` | 🔴 HIGH | HALF_OPEN allows unlimited concurrent probes (thundering herd) |
| 3 | `pii.ts` | 🟡 MED | SSN pattern matches any 9-digit sequence |
| 4 | `pii.ts` | 🟡 MED | `checkInputPii` / `checkOutputPii` near-duplicates with hidden overlap |
| 5 | `domain.ts` | 🟡 MED | `context-terminator` pattern incomplete vs. its own comment |
| 6 | `domain.ts` | 🟡 MED | `sql-exec` fires on common English word "execute" without structural anchoring |
| 7 | `index.ts` | 🟡 MED | Zod error-code derivation duplicated verbatim across both pipeline functions |
| 8 | `index.ts` | 🟡 MED | Inconsistent Layer-2 check ordering between translate and TTS pipelines |
| 9 | `index.ts` | 🟡 MED | Redundant `as Gender` casts mask potential type misalignment |
| 10 | `schemas.ts` | 🟡 MED | Stale comment points to wrong file; SUPPORTED_LANGS and DEEPL_LANG_MAP can drift |
| 11 | `request-hardening.ts` | 🟡 MED | Silent fallback to default speaker ID — no warning log emitted |
| 12 | `circuit-breaker.ts` | 🟡 MED | `getCircuitBreaker` silently discards config on subsequent calls |
| 13 | `output-validation.ts` | 🟡 MED | Type guard doesn't null-check `translations[0]` — null throws at runtime |
| 14 | `output-validation.ts` | 🟡 MED | Translate route omits logging on L4 rejection (inconsistent with TTS) |
| 15 | `translate/route.ts` | 🟡 MED | `DEEPL_API_KEY` captured at module load time (inconsistent with request-time pattern) |
| 16 | Both routes | 🟡 MED | No body size guard before `request.json()` — DoS via oversized payloads |
| 17 | `domain.ts` | 🔵 LOW | `checkTranslateLang` / `checkTtsLang` structurally identical (DRY) |
| 18 | `index.ts` | 🔵 LOW | `applyGuardrails` exported but never used internally — dead API surface |
| 19 | `index.ts` | 🔵 LOW | Final `logPass` uses wrong layer label (`input-validation` after all layers pass) |
| 20 | `logger.ts` | 🔵 LOW | `safeLength` is a zero-logic wrapper; mixed usage with inline `.length` |
| 21 | `logger.ts` | 🔵 LOW | `logCircuitBreaker` exists but is never called from `circuit-breaker.ts` |
| 22 | Both routes | 🔵 LOW | `fallbackResponse` helper duplicated across both route files |

Full report: `audit-reports/AUDIT-2026-04-21-2205/individual/principal.md`

---

### Security Auditor — 2 High · 6 Medium · 7 Hardening

| ID | File | Severity | OWASP | Title |
|----|------|----------|-------|-------|
| HIGH-1 | `translate/route.ts` | 🔴 High | A01 | No authentication on translate route |
| HIGH-2 | Both routes | 🔴 High | A04 | No rate limiting on public endpoints |
| MED-1 | `translate/route.ts` | 🟡 Med | A02 | Raw upstream error message in server log meta |
| MED-2 | `tts/route.ts` | 🟡 Med | A02 | TtsError message logged without sanitization |
| MED-3 | `domain.ts` | 🟡 Med | A03 | Injection bypass via Unicode homoglyph substitution |
| MED-4 | `domain.ts` | 🟡 Med | A03 | Injection detection gaps: XML tags, encoding variants |
| MED-5 | `domain.ts` | 🟡 Med | A05 | Detection internals (detectedTypes) exposed in error response |
| MED-6 | `request-hardening.ts` | 🟡 Med | A05 | SPEAKER_IDX_PATTERN regex string in 500 error response |
| LOW-1 | `pii.ts` | 🔵 Hard | A03 | Passport PII pattern too broad |
| LOW-2 | `tts/route.ts` | 🔵 Hard | A05 | X-TTS-Provider/X-TTS-Model headers expose backend |
| LOW-3 | `sanitize.ts` | 🔵 Hard | A03 | ATTR_INJECT_REGEX misses unquoted/space-free attributes |
| LOW-4 | `sanitize.ts` | 🔵 Hard | A03 | `javascript:` URIs not filtered |
| LOW-5 | `circuit-breaker.ts` | 🔵 Hard | A04 | In-memory circuit breaker resets on serverless cold start |
| LOW-6 | `circuit-breaker.ts` | 🔵 Hard | A01 | `reset()` has no access control guard |
| LOW-7 | `output-validation.ts` | 🔵 Hard | A04 | No audio buffer magic bytes validation |

Full report: `audit-reports/AUDIT-2026-04-21-2205/individual/security.md`

---

### DevOps Engineer — 4 High · 4 Medium · 4 Low

| # | Severity | File(s) | Finding |
|---|----------|---------|---------|
| 1 | 🔴 High | `circuit-breaker.ts` | In-memory state lost on cold start — circuit breaker ineffective in serverless |
| 2 | 🔴 High | `translate/route.ts` | No fetch timeout on DeepL API call — function can hang indefinitely |
| 3 | 🔴 High | Both routes | No rate limiting on public endpoints calling paid external APIs |
| 4 | 🔴 High | `tts/route.ts` | No timeout on `synthesizeSpeech` — HF Space cold starts block 30–60 s |
| 5 | 🟡 Med | `circuit-breaker.ts` | HALF_OPEN allows all concurrent requests through (should be one probe) |
| 6 | 🟡 Med | Both routes | No fail-fast env var validation at startup — missing keys surface at request time |
| 7 | 🟡 Med | Both routes | No retry with exponential backoff — transient failures unnecessarily trip circuit |
| 8 | 🟡 Med | Both routes | External API error messages logged verbatim — risk of key/data leakage |
| 9 | 🔵 Low | Both routes | `fallbackResponse` helper duplicated |
| 10 | 🔵 Low | Both routes | No request correlation ID in logs — concurrent failures un-correlatable |
| 11 | 🔵 Low | `request-hardening.ts` | Stale comment references phantom `DEEPL_LANG_MAP` in `route.ts` |
| 12 | 🔵 Low | `index.ts` | `getAllSnapshots()` exported but no `/api/health` route wired up |

Full report: `audit-reports/AUDIT-2026-04-21-2205/individual/devops.md`

---

### Accessibility Auditor — 0 High · 3 Medium · 4 Low

> Scope is API-only (no UI components). WCAG UI checklist items do not apply. Findings focus on HTTP semantics, error response clarity, and accessible client-side contract.

| ID | Severity | File(s) | Issue |
|----|----------|---------|-------|
| MED-01 | 🟡 Med | Both routes | JSON parse failure returns 500 instead of 400 (client error misclassified) |
| MED-02 | 🟡 Med | `fallback.ts`, both routes | No `Retry-After` header on 503 responses — AT retry UX cannot determine wait |
| MED-03 | 🟡 Med | `fallback.ts` | TTS fallback message omits text-preservation assurance (unlike translate) |
| LOW-01 | 🔵 Low | Both routes | `fallbackResponse` guard branch emits structurally inconsistent error body |
| LOW-02 | 🔵 Low | `fallback.ts` | `internalErrorFallback` message provides no actionable specificity |
| LOW-03 | 🔵 Low | `tts/route.ts` | Binary/JSON content-type duality is undocumented |
| LOW-04 | 🔵 Low | `schemas.ts` | Binary gender enum values should not be surfaced verbatim in accessible UI |

**Positive findings:** Consistent `GuardrailErrorResponse` shape, rich `GuardrailErrorCode` enum, `layer` field for triage, `inputLength` in fallback details, and Zod error messages are human-readable and directly usable in accessible form validation.

Full report: `audit-reports/AUDIT-2026-04-21-2205/individual/a11y.md`

---

### Patterns Auditor — 0 High · 4 Medium · 7 Low

| ID | Severity | Description | Files | Suggested Target |
|----|----------|-------------|-------|-----------------|
| M-1 | 🟡 Med | Zod parse-error block duplicated ~26 lines | `index.ts` ×2 | `handleZodFailure()` private helper |
| M-2 | 🟡 Med | Sanitize + PII check block duplicated ~15 lines | `index.ts` ×2 | `sanitizeAndCheckPii()` private helper |
| M-3 | 🟡 Med | `fallbackResponse` helper duplicated in both routes | Both routes | `lib/guardrails/http.ts` |
| M-4 | 🟡 Med | `checkTranslateLang` / `checkTtsLang` structurally identical | `domain.ts` ×2 | `makeCheckLang<T>()` factory |
| L-1 | 🔵 Low | `InjectionPattern` / `ContentPattern` interfaces identical | `domain.ts` | Unify to `DomainPattern` |
| L-2 | 🔵 Low | `detectInjection` / `detectContentViolation` scan loops identical | `domain.ts` ×2 | `scanPatterns()` private utility |
| L-3 | 🔵 Low | `checkInputPii` / `checkOutputPii` duplicate detection + shape | `pii.ts` ×2 | `makePiiError()` private helper |
| L-4 | 🔵 Low | Circuit-open logging bypasses `logCircuitBreaker` wrapper | `index.ts` ×2 | Replace with `logCircuitBreaker()` |
| L-5 | 🔵 Low | Stale `DEEPL_LANG_MAP` sync comment | `request-hardening.ts` | Remove/update comment |
| L-6 | 🔵 Low | Domain check ordering asymmetry between pipelines | `index.ts` | Align ordering convention |
| L-7 | 🔵 Low | JSON-parse try/catch duplicated in both routes | Both routes | `parseRequestBody()` helper |

**Clean:** `GuardrailResult<T>` usage, error codes, `makeFallback`, `sanitizeText`, circuit breaker singleton, schema centralisation, and logger convenience wrappers are all well-abstracted.

Full report: `audit-reports/AUDIT-2026-04-21-2205/individual/patterns.md`

---

## Files Needing Immediate Attention (Deduplicated)

| File | Unique Issues | Top Concern |
|------|---------------|-------------|
| `app/api/translate/route.ts` | High: 3, Med: 6 | Auth, rate limit, timeout — deploy blockers |
| `app/api/tts/route.ts` | High: 3, Med: 5 | Auth, rate limit, TTS timeout — deploy blockers |
| `lib/guardrails/pii.ts` | High: 1, Med: 2 | Passport regex false positive rate |
| `lib/guardrails/circuit-breaker.ts` | High: 2, Med: 1 | Serverless incompatibility, HALF_OPEN concurrency |
| `lib/guardrails/domain.ts` | Med: 4 | Injection bypasses, execution false positive, info leakage |
| `lib/guardrails/index.ts` | Med: 4, Low: 4 | DRY violations, ordering inconsistency |
| `lib/guardrails/output-validation.ts` | Med: 2 | Null crash path, missing L4 log |

---

## Recommended Remediation Order

### P0 — Before any production deployment
1. **Add auth middleware** to both routes (A01 — Broken Access Control)
2. **Add rate limiting** at the edge (A04 — denial-of-wallet)
3. **Add fetch timeouts** to DeepL call and `synthesizeSpeech` (production stability)
4. **Fix passport regex** to require keyword anchoring (usability)
5. **Remove `detectedTypes` from injection error responses** (A05 — attacker feedback loop)

### P1 — Fix in this sprint
6. **Add body size guard** before `request.json()` (DoS, one-liner)
7. **Fix `isDeepLResponseBody` null guard** for `translations[0]` (runtime crash)
8. **Add L4 logging to translate route** (monitoring parity)
9. **Expose `detectedCount` not pattern details** in request-hardening 500 error
10. **Fix JSON parse error to return 400 not 500** (HTTP semantics)
11. **Add `Retry-After` header on 503 responses** (accessibility + AT integration)
12. **Add fail-fast env var validation** at startup

### P2 — Hardening
13. Document or migrate circuit breaker to persistent store (Vercel KV/Upstash)
14. Add Unicode confusable detection for injection bypass
15. Add `javascript:` URI filter in `sanitize.ts`
16. Remove `X-TTS-Provider` / `X-TTS-Model` response headers
17. Validate audio magic bytes in output validation
18. Add `/api/health` endpoint consuming `getAllSnapshots()`
19. Add request correlation ID to all log events

### P3 — DRY cleanup (can batch into one PR)
20. Extract `handleZodFailure()` helper in `index.ts`
21. Extract `sanitizeAndCheckPii()` helper in `index.ts`
22. Extract `fallbackResponse` to `lib/guardrails/http.ts`
23. Refactor `checkTranslateLang` / `checkTtsLang` to `makeCheckLang<T>()` factory
24. Unify `InjectionPattern` / `ContentPattern` to `DomainPattern`
25. Extract `scanPatterns()` private utility in `domain.ts`
26. Wire `logCircuitBreaker` into `circuit-breaker.ts` state transitions
27. Align Layer-2 check ordering between translate and TTS pipelines

---

## Worker Execution Summary

| Batch | Workers | Model Tier | Status |
|-------|---------|------------|--------|
| 1 | principal, security, devops, a11y | default (×2), fast (×2) | ✅ Complete |
| 2 | patterns | fast | ✅ Complete |

Sub-agents spawned: 5 | Reports: principal.md, security.md, devops.md, a11y.md, patterns.md | Model tiers: principal=default, security=default, devops=fast, a11y=fast, patterns=fast
