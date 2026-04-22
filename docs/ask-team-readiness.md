# Ask (Q&A) — internal team readiness

Use this before demos, regression passes, or handing work to another squad. **Hiring partner / fellowship demos:** start with [`fellowship-partner-demo.md`](./fellowship-partner-demo.md) for the full presenter script and device guidance. **Merge / demo tomorrow night:** use the checkbox-only sheet [`evaluations/ask-ship-checklist.md`](./evaluations/ask-ship-checklist.md). Ask is **browser RAG + POST `/api/ask`** (see `AskTab.tsx` header comment and `app/api/ask/route.ts`).

## Environment (required for a real answer)

1. Copy `.env.local.example` → `.env.local`.
2. Set **`HF_TOKEN`** (fine-grained: Inference Providers, or classic token with inference scope). Ask and Summary share this token.
3. Optional: **`HF_ASK_MODEL`**, **`HF_ASK_BASE_URL`** if the default router model is blocked on your account (see comments in `app/api/ask/route.ts`).

Without `HF_TOKEN`, Ask returns **503** and the UI shows the server error string (configuration hint).

## Quick smoke (5 minutes)

Run **`npm run dev`**, open a document on the translate flow with **chunks ready** (Ask input enabled).

| Step | Action | Expect |
|------|--------|--------|
| 1 | Ask one question in **English** | Streamed answer; trust pill + sources if refs exist |
| 2 | Ask in **Spanish** (e.g. with `¿`) | Chrome / `answerLanguage` align ES; answer in Spanish per prompt |
| 3 | Short Spanish **“chao”** after a Spanish turn | Not forced to English API language |
| 4 | Turn off network → Send | Localized offline message |
| 5 | Error banner → **Try again** | Retries last question (`lastQuestionForRetryRef`) |

## Automated checks (CI-friendly)

```bash
npm run typecheck
npm run test:ask
```

`test:ask` runs only Ask-related unit tests (locale heuristics, confidence bands, guardrails). Full `npm run test:unit` may still fail on **unrelated** suites (OCR/extract mocks); do not block Ask merges on those until owned.

## User-visible error classes (localized EN / ES / VI)

- **Offline** — `navigator.onLine` false  
- **Timeout** — network, abort, `queryChunks` timeout, stream timeout patterns  
- **Provider busy / quota** — HTTP 402/429 or stream text matching quota / rate limit  
- **Empty reply** — stream completed with no assistant text  
- **Generic failure** — everything else  
- **503** — server body shown when present (e.g. missing `HF_TOKEN`)  
- **Guardrails** — 400/422/413 with **server `error` string** (Zaria ticket)

Dev-only: **`console.warn('[ask-tab] ask failed:', …)`** for stream/HF debugging.

## Known limitations (tell PM / support)

- **Overlap-based trust pill** is a lexical proxy, not model confidence; tuned in `lib/askConfidenceBands.ts`. Vietnamese overlap is rough until better tokenization.  
- **Model may ignore output language** rarely; `answerLanguage` + system prompt are best-effort.  
- **LangSmith** export is optional; see `.env.local.example` and `lib/langsmithAskRun.ts`.  
- **Chat history** is IndexedDB (EntityDB); clearing site data clears history.

## Ownership tags in code

Bracket comments (**`[Jasmin]`**, **`[Brandi]`**, **`[Karlee]`**, **`[Zaria]`**, **`[Team 1 eval]`**) mark UX, RAG/chunks, model/API, guardrails, and eval rubric areas—keep them when you touch those concerns.

## Merging to **main dev** (PR checklist)

Use this before you open or merge the PR so `main` stays clean.

- [ ] **`npm run typecheck`** and **`npm run test:ask`** pass locally.
- [ ] **`npm run lint`** on touched paths (or full `lint` if your team requires it).
- [ ] **Do not commit** `logs/` churn — `logs/` is in `.gitignore`; if `logs/logs.json` still appears as modified, it may be **tracked by mistake** (`git restore` it, or remove from the index in a follow-up so it stops reappearing).
- [ ] **Do not commit** `.env.local** or secrets (already gitignored; double-check the PR diff).
- [ ] **Stage `docs/`** (runbooks, `evaluations/ask-ship-checklist.md`, `evaluations/ask-gold-pairs.seed.jsonl`) and new **`lib/`** / **`tests/ask*.test.ts`** files so partners get the runbooks.
- [ ] Optional: omit scratch files (e.g. local integration plans) unless the team agreed to add them.
- [ ] PR description: call out **HF_TOKEN** for Ask/Summary, **`npm run test:ask`** for CI, and **desktop** path for fellowship demos (`docs/fellowship-partner-demo.md`).

## Related docs

- Ship / eval checklist: `docs/evaluations/ask-ship-checklist.md`
