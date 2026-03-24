# Patterns & Abstraction Audit — Q&A Chat UI

**Scope:** `app/api/ask/route.ts`, `components/features/document/QAPanel.tsx`  
**Context:** Other API routes (`app/api/summarize/route.ts`, `app/api/safety/route.ts`) reviewed for shared-handler patterns.

---

## Summary

The Q&A stack cleanly separates **client retrieval** (`queryChunks` → `chunks` in `sendMessage` body) from **server streaming** (`streamText` + `toUIMessageStreamResponse`). The main maintainability risks are **duplicated request-body normalization** on the route and **parallel “assistant loading” UI paths** in the panel—not lack of structure overall.

---

## Findings

### 🟡 Medium

| ID | Topic | Detail |
|----|--------|--------|
| PA-1 | **Repeated `chunks` extraction** | `chunks = Array.isArray(body?.chunks) ? body.chunks : []` appears in both the `messages` branch and the legacy `question` branch (`route.ts`). Any change to chunk typing or defaults must be edited in two places. |
| PA-2 | **Bifurcated body parsing without a named abstraction** | The handler mixes two contracts (v3 `messages` + optional `chunks` vs legacy `question` + `context`/`chunks`) inline. A single function such as `parseAskPostBody(body: unknown): { ok: true; modelMessages; chunks } \| { ok: false; response }` (or Zod) would centralize branching and reduce regression risk when adding fields. |
| PA-3 | **Overlapping legacy context normalization** | In the legacy branch, `contextText` can be built from `context` or from joined `chunks`, then `chunks` is repopulated from `contextText` when empty. The `messages` path only reads `chunks`. Documenting or encapsulating this matrix in one place avoids subtle drift between shapes. |

### 🔵 Low

| ID | Topic | Detail |
|----|--------|--------|
| PA-4 | **System prompt as inline string assembly** | RAG instructions and section delimiters are built inline. A small `buildDocumentQaSystemPrompt(chunks: string[])` (or constant + interpolator) would improve testability and reuse if summarization or other routes share the same persona text. |
| PA-5 | **Manual SSE fallback stream** | The no-`OPENAI_API_KEY` path hand-builds UI-stream-shaped SSE events. If another route needs the same “degraded stream” behavior, extract a helper that returns `Response` with the same wire format. |
| PA-6 | **QAPanel: duplicated assistant-loading affordances** | Loading state appears in two forms: (a) empty text branch with `<Spinner>` inside the assistant bubble, and (b) a separate “Thinking…” row when the last message is user. The intent differs, but **spinner + `aria-label="Generating answer"`** is duplicated; a tiny `AssistantSpinner` or shared constant for the label reduces drift. |
| PA-7 | **Chat row presentation not componentized** | User vs assistant bubbles use `cn(...)` with role-based classes (~15 lines in the `map`). Extracting `ChatMessageRow` / `MessageBubble` would clarify props (`role`, `children`) and match patterns used elsewhere if more chat features arrive. |
| PA-8 | **`getMessageText` locality** | The helper correctly narrows text parts; it is only used in this file. If other components consume `UIMessage` parts, move to e.g. `lib/ai/messageParts.ts` to avoid copy-paste. |
| PA-9 | **Scroll-to-bottom + chat coupling** | `useEffect` + `bottomRef` + `[messages, isLoading]` is a good candidate for `useScrollIntoViewOnChange(deps)` for reuse in other scrollable panels. |
| PA-10 | **Hardcoded API path** | `DefaultChatTransport({ api: "/api/ask" })` matches a string used in docs/README; a shared `API_ROUTES.ASK` (or env-based base URL) keeps renames and deployments consistent. |
| PA-11 | **Cross-route validation style** | `summarize` and `ask` use `body?.field as string`; `safety` uses a typed helper and explicit JSON parse error handling. No shared “parse JSON + validate” utility exists—optional future consolidation, not required for this feature in isolation. |

---

## Cross-cutting observation (broader codebase)

Other `app/api/*/route.ts` files each implement their own `try/catch` + `NextResponse.json` error shape. **Centralized validation or small helpers** (as in `safety/route.ts`’s `getTextToAnalyze`) would reduce repeated patterns when the API surface grows; this is a **project-level** opportunity, not specific to Q&A.

---

## Severity counts (this audit)

| Level | Count |
|-------|-------|
| High | 0 |
| Medium | 3 |
| Low | 8 |

*This role’s rubric emphasizes duplication and abstraction debt; no “High” items were identified for patterns-only scope (auth, rate limits, etc. are covered by other audit tracks).*

---

## Positive patterns

- **Transport singleton** (`const transport = new DefaultChatTransport(...)`) avoids recreating the client per render.
- **Separation of concerns:** retrieval stays in `entitydb`; the route stays focused on model I/O.
- **`getMessageText` with a type guard** is preferable to ad-hoc string concatenation on unknown parts.
