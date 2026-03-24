# Principal Engineer Audit Report

**Date:** 2026-03-24  
**Auditor Role:** Principal Engineer  
**Scope:** Q&A Chat-UI Component Implementation  

| File | Lines |
|------|-------|
| `app/api/ask/route.ts` | 101 |
| `components/features/document/QAPanel.tsx` | 157 |

---

## Summary

The Q&A feature is cleanly structured at a surface level — the route handler streams LLM responses and the client component provides a competent chat UI. However, there are significant gaps in **security boundaries**, **error observability**, and **input validation** that make this implementation unsuitable for production without remediation.

---

## Findings

### F-01 — 🔴 High — No authentication on the `/api/ask` route handler

**File:** `app/api/ask/route.ts` (line 14)

The `POST` handler performs no identity or session check before invoking the OpenAI API. Any unauthenticated HTTP client can call this endpoint, generating unbounded OpenAI API costs. This is the most critical finding.

**Recommendation:** Add authentication middleware (e.g., `next-auth` session check, JWT validation, or API key) at the top of the handler. Return `401` for unauthenticated requests before any processing occurs.

---

### F-02 — 🔴 High — No input size validation on `chunks` or `messages`

**File:** `app/api/ask/route.ts` (lines 21–46, 82)

User-supplied `chunks` and `messages` arrays are accepted with no size or length limits. Chunks are concatenated directly into the system prompt (line 82). A malicious or buggy client can send arbitrarily large payloads, resulting in:

- Token exhaustion and inflated API bills
- Request timeouts or OOM in the route handler
- Potential denial of service

**Recommendation:** Enforce maximum array lengths (e.g., `chunks.length <= 20`), maximum per-chunk character length (e.g., 4000 chars), and total combined prompt size. Return `400` when limits are exceeded.

---

### F-03 — 🔴 High — Silent error swallowing in catch block

**File:** `app/api/ask/route.ts` (lines 94–98)

```typescript
} catch {
  return NextResponse.json(
    { error: "Question answering failed" },
    { status: 500 }
  );
}
```

The catch clause discards the error entirely — no logging, no error tracking, no request correlation ID. In production, this makes it impossible to diagnose failures (malformed input, OpenAI outages, SDK bugs, etc.).

**Recommendation:** Capture the error, log it with structured metadata (request ID, timestamp, error stack), and forward to an error tracking service. Consider returning a more specific user-facing message when safe to do so.

---

### F-04 — 🔴 High — Unhandled async errors in `onSubmit`

**File:** `components/features/document/QAPanel.tsx` (lines 50–61)

```typescript
async function onSubmit(e: React.FormEvent): Promise<void> {
  e.preventDefault();
  if (!input.trim() || isLoading) return;
  const question = input;
  setInput("");
  const results = await queryChunks(question);    // can throw
  const chunks = results.map((r) => r.text);
  await sendMessage({ text: question }, { body: { chunks } });  // can throw
}
```

Neither `queryChunks()` nor `sendMessage()` is wrapped in try/catch. If either rejects (network failure, malformed response, EntityDB unavailable), the promise rejection propagates to React's synthetic event handler and is silently lost. The user sees no feedback, and the UI is left in a broken state: input has been cleared (line 55) but no message was sent.

**Recommendation:** Wrap the body of `onSubmit` in try/catch. On error, restore the input value, and surface the error in the UI (e.g., via a local error state or a toast).

---

### F-05 — 🟡 Medium — Prompt injection via unsanitized chunks

**File:** `app/api/ask/route.ts` (lines 75–85)

User-supplied chunks are concatenated directly into the LLM system prompt with only delimiter markers (`=== Context Excerpts ===`). A crafted chunk containing text like `"Ignore all previous instructions..."` can override the system prompt's constraints. While this is an inherent LLM risk, no defensive measures are taken.

**Recommendation:** Apply basic sanitization (strip known injection patterns), enforce chunk length limits (see F-02), and consider moving to a separate `user` message role for context rather than embedding in the system prompt.

---

### F-06 — 🟡 Medium — Unsafe type assertions without runtime validation

**Files:**
- `app/api/ask/route.ts` (lines 27, 29): `body.question as string`, `body.context as string | undefined`
- `components/features/document/QAPanel.tsx` (line 80): `message.parts as { type: string; text?: string }[]`

These `as` casts bypass TypeScript's type checking without runtime guards. If `body.question` is a number, object, or array, it silently proceeds and may produce unexpected LLM input. If `message.parts` is `undefined` or has a different shape, the `.filter()` call throws at runtime.

**Recommendation:** Use a runtime validation library (e.g., `zod`) for the route handler's request body. For the client component, add a defensive nullish check before casting `message.parts`.

---

### F-07 — 🟡 Medium — Duplicated chunk extraction logic

**File:** `app/api/ask/route.ts` (lines 23, 30–32, 33)

The expression `Array.isArray(body?.chunks) ? body.chunks : []` appears three times with minor variations. This duplication increases the risk of inconsistent changes and makes the input parsing logic harder to follow.

**Recommendation:** Extract chunk parsing to a single declaration at the top of the try block:

```typescript
const chunks: string[] = Array.isArray(body?.chunks) ? body.chunks : [];
```

---

### F-08 — 🟡 Medium — Hand-rolled SSE fallback bypasses SDK protocol

**File:** `app/api/ask/route.ts` (lines 53–71)

When `OPENAI_API_KEY` is missing, the handler manually constructs SSE events mimicking the AI SDK's UIMessage stream protocol. This is brittle — if the SDK's wire format changes in a future version, this fallback will silently break, causing the client to fail to parse the stream or show no output.

**Recommendation:** Use the SDK's own primitives to construct the fallback stream (e.g., a mock `streamText` result or the SDK's stream helpers), or return a standard JSON error response and handle the "no API key" state on the client.

---

### F-09 — 🟡 Medium — Client-side RAG retrieval tightly coupled to UI

**File:** `components/features/document/QAPanel.tsx` (lines 57–58)

The component directly calls `queryChunks()` — a data retrieval operation — inside its form submit handler. This couples the UI component to the retrieval implementation and creates issues:

- The retrieval runs client-side, exposing the embedding/search logic to the browser
- Testing the component requires mocking `queryChunks`
- If retrieval needs to move server-side (e.g., for security or performance), the component must change

**Recommendation:** Move chunk retrieval to the server by having the route handler call `queryChunks` based on the latest user message, or abstract it behind a custom hook.

---

### F-10 — 🟡 Medium — No conversation length limit

**File:** `components/features/document/QAPanel.tsx` (lines 78–109)

There is no upper bound on the number of messages rendered. The entire `messages` array is mapped on every render, and all message parts are re-processed via `getMessageText`. In extended conversations (50+ messages), this will degrade rendering performance and may cause the LLM context window to overflow on the server side (all messages are sent back via `useChat`).

**Recommendation:** Implement a maximum visible message window (e.g., show last 50 messages with a "load more" option), and/or truncate the conversation history sent to the API to fit within the model's context window.

---

### F-11 — 🟡 Medium — Magic string for default model name

**File:** `app/api/ask/route.ts` (line 88)

```typescript
model: openai(process.env.OPENAI_MODEL ?? "gpt-4o-mini"),
```

The fallback model `"gpt-4o-mini"` is a magic string. If this default needs to change (e.g., model deprecation), it must be found in the source code rather than a configuration constant.

**Recommendation:** Define a named constant (e.g., `DEFAULT_OPENAI_MODEL`) in a shared config module.

---

## Findings Summary

| # | Severity | Title | File |
|---|----------|-------|------|
| F-01 | 🔴 High | No authentication on route handler | `route.ts` |
| F-02 | 🔴 High | No input size validation on chunks/messages | `route.ts` |
| F-03 | 🔴 High | Silent error swallowing in catch block | `route.ts` |
| F-04 | 🔴 High | Unhandled async errors in onSubmit | `QAPanel.tsx` |
| F-05 | 🟡 Medium | Prompt injection via unsanitized chunks | `route.ts` |
| F-06 | 🟡 Medium | Unsafe type assertions without runtime validation | Both files |
| F-07 | 🟡 Medium | Duplicated chunk extraction logic | `route.ts` |
| F-08 | 🟡 Medium | Hand-rolled SSE fallback bypasses SDK protocol | `route.ts` |
| F-09 | 🟡 Medium | Client-side RAG retrieval coupled to UI | `QAPanel.tsx` |
| F-10 | 🟡 Medium | No conversation length limit | `QAPanel.tsx` |
| F-11 | 🟡 Medium | Magic string for default model name | `route.ts` |
