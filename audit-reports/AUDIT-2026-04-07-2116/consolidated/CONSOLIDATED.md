# Consolidated Audit Report — Chat History Persistence

**Date:** 2026-04-07 21:16  
**Scope:** `lib/entitydb.ts`, `hooks/useChatHistory.ts`, `components/features/ask/AskTab.tsx`  
**Context files reviewed:** `lib/entitydb-persist.ts`, `hooks/useDocumentSession.ts`, `app/api/ask/route.ts`

---

## Executive Summary

| Role | 🔴 High | 🟡 Medium | 🔵 Low | Status |
|------|---------|-----------|--------|--------|
| Principal Engineer | 2 | 5 | 3 | ⚠️ Critical |
| Security Auditor | 1 | 3 | 3 | ⚠️ Critical |
| DevOps Engineer | 0 | 4 | 2 | 🟡 Warn |
| Accessibility Auditor | 1 | 2 | 3 | ⚠️ Critical |
| Patterns Auditor | 0 | 2 | 4 | 🟡 Warn |
| **Totals** | **4** | **16** | **15** | |

---

## Top 5 Action Items

1. **[SECURITY H1] Add authentication to `/api/ask` endpoint** — The route handler has no auth middleware, session check, or authorization. Any HTTP client can POST and consume OpenAI API credits. Fix immediately before deploying to production.

2. **[PRINCIPAL H2 / SECURITY M2 / DEVOPS M1] Replace `getAll()` full-table scan in `getChatHistory`** — Loading every record from the `vectors` store into memory and filtering in JavaScript is O(n) on total store size. Create an IDB index on `[entityKey, docId]` or use a separate store for chat messages. Three auditors independently flagged this.

3. **[PRINCIPAL H1 / PATTERNS M1] Extract shared `EntityDBInternal` + `getIdb()`** — The internal IDB interface is copy-pasted across 3 files. Extract into a single shared module (`lib/entitydb-internal.ts`) to eliminate shotgun surgery risk.

4. **[A11Y H1] Fix Send button accessible name during loading state** — When `isLoading` is true, the button renders only a `<Spinner aria-hidden="true" />`, leaving it with no accessible name. Add `aria-label` or a visually hidden text span.

5. **[PRINCIPAL M2 / DEVOPS M4 / A11Y M1] Surface `chatHistory.error` in AskTab** — History load failures are silently swallowed. Users see an empty chat with no explanation. Display the error using the existing `Alert` pattern.

---

## Per-Role Findings

### Principal Engineer

| ID | Severity | Finding |
|----|----------|---------|
| H1 | 🔴 High | `EntityDBInternal` + `getIdb()` duplicated across 3 files |
| H2 | 🔴 High | `getChatHistory` performs full table scan of `vectors` store |
| M1 | 🟡 Medium | `entitydb.ts` mixes RAG chunk and chat message domains |
| M2 | 🟡 Medium | `addMessage` errors silently drop the exchange from the UI |
| M3 | 🟡 Medium | Timestamp mismatch between optimistic UI and persisted record |
| M4 | 🟡 Medium | Sequential user/assistant message persistence is not atomic |
| M5 | 🟡 Medium | Dual JSON/streaming parse approach is fragile and wasteful |
| L1 | 🔵 Low | Magic number `3000` for queryChunks timeout |
| L2 | 🔵 Low | Array index used as React key for message list |
| L3 | 🔵 Low | No message count cap or cleanup strategy |

### Security Auditor

| ID | Severity | OWASP | Finding |
|----|----------|-------|---------|
| H1 | 🔴 High | A01 | Unauthenticated `/api/ask` endpoint — cost abuse |
| M1 | 🟡 Medium | A03 | Unsanitized content persisted to IndexedDB — stored XSS vector |
| M2 | 🟡 Medium | A01 | `getAll()` full store scan over-fetches across entity boundaries |
| M3 | 🟡 Medium | A03 | Prompt injection via user-controlled content in LLM system prompt |
| L1 | 🔵 Low | A02 | No encryption at rest for sensitive chat data |
| L2 | 🔵 Low | A04 | Unbounded chat history growth — no message cap |
| L3 | 🔵 Low | A05 | API error messages passed through to UI without filtering |

### DevOps Engineer

| ID | Severity | Finding |
|----|----------|---------|
| M1 | 🟡 Medium | Full-store read on every history load — scalability |
| M2 | 🟡 Medium | Embedding work on every persisted chat message — resource cost |
| M3 | 🟡 Medium | Persistence failures not observable outside the UI |
| M4 | 🟡 Medium | `chatHistory.error` not surfaced in AskTab |
| L1 | 🔵 Low | Fixed vector path and embedding model (hardcoded config) |
| L2 | 🔵 Low | IndexedDB operations without timeout or retry |

### Accessibility Auditor

| ID | Severity | WCAG | Finding |
|----|----------|------|---------|
| H1 | 🔴 High | 4.1.2 | Send button has no accessible name while loading |
| M1 | 🟡 Medium | 3.3.1 | Persisted history load failures not shown in AskTab |
| M2 | 🟡 Medium | — | Loading/streaming content not announced via aria-live |
| L1 | 🔵 Low | 1.3.1 | CardTitle is a styled `<div>`, not a heading |
| L2 | 🔵 Low | 1.3.1 | Message list lacks labeled region / log semantics |
| L3 | 🔵 Low | — | Chat bubbles don't expose speaker identity for SR |

### Patterns Auditor

| ID | Severity | Finding |
|----|----------|---------|
| M1 | 🟡 Medium | `EntityDBInternal` + `getIdb()` triplicated across files |
| M2 | 🟡 Medium | `useDocumentSession` reimplements `getDocumentFromEntityDB` |
| L1 | 🔵 Low | Shared async-load hook pattern extractable |
| L2 | 🔵 Low | Duplicate JSON `answer` parsing in AskTab |
| L3 | 🔵 Low | Two constants for `extracted_document` entity key |
| L4 | 🔵 Low | `PendingMessage` vs `ChatMessage` type overlap |

---

## Files Needing Immediate Attention

| File | High Findings | Roles Flagging Issues |
|------|---------------|----------------------|
| `components/features/ask/AskTab.tsx` | 1 (A11Y) | All 5 roles |
| `lib/entitydb.ts` | 2 (Principal) | Principal, Security, DevOps, Patterns |
| `app/api/ask/route.ts` | 1 (Security) | Security |
| `hooks/useChatHistory.ts` | — | Principal, DevOps, Patterns |
| `lib/entitydb-persist.ts` | — | Patterns |
| `hooks/useDocumentSession.ts` | — | Patterns |

---

## Cross-Cutting Themes

Several findings were independently flagged by multiple auditors:

1. **`getAll()` full table scan** — flagged by Principal (H2), Security (M2), DevOps (M1)
2. **`chatHistory.error` not surfaced** — flagged by Principal (M2), DevOps (M4), A11y (M1)
3. **`EntityDBInternal` duplication** — flagged by Principal (H1), Patterns (M1)
4. **Unbounded message growth** — flagged by Principal (L3), Security (L2)

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

- **Batch 1** (concurrent): Principal, Security, DevOps, A11y — 4 workers
- **Batch 2** (sequential): Patterns — 1 worker
- **Total workers:** 5

---

## Individual Reports

- [`principal.md`](../individual/principal.md)
- [`security.md`](../individual/security.md)
- [`devops.md`](../individual/devops.md)
- [`a11y.md`](../individual/a11y.md)
- [`patterns.md`](../individual/patterns.md)
