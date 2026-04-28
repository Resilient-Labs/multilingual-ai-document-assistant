# Multilingual AI Document Assistant

Privacy-first document assistant with **zero-retention** architecture. Documents are processed but **never stored on servers**. All persistent data lives in the user's browser (EntityDB). Backend is stateless.

**Key points:**

- **EntityDB** — IndexedDB under the hood + Transformers.js for embeddings and semantic search
- **Stateless API pattern** — routes process and return results without database persistence

---

## Local Setup / Onboarding

Use this guide to get set up locally and ready to contribute.

**Quick start (copy & paste):**
*Warning: Still needs .env.local variables*

```bash
git clone https://github.com/Resilient-Labs/multilingual-ai-document-assistant.git
cd multilingual-ai-document-assistant
npm install
npm run build
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000). No Redis or server storage required.

---

### Prerequisites

- **Node.js** 18.x or 20.x ([nodejs.org](https://nodejs.org))
- **npm** 9+ (comes with Node.js)
- **Git** (for cloning)

### 1. Clone the repository

```bash
git clone https://github.com/Resilient-Labs/multilingual-ai-document-assistant.git
cd multilingual-ai-document-assistant
```

### 2. Install dependencies

```bash
npm install
```

**What this installs:**

Exact versions live in [`package.json`](package.json).

**Runtime (`dependencies`):**

| Packages | Role | Install notes |
| -------- | ---- | ------------- |
| `next`, `react`, `react-dom` | Next.js app framework | Standard install |
| `@ai-sdk/openai`, `ai` | LLM calls (Vercel AI SDK + OpenAI) | Standard install |
| `langsmith` | Optional LLM tracing / observability | Standard install |
| `@babycommando/entity-db` | In-browser vector DB (IndexedDB + Transformers.js) | Often slower first time; WASM / heavy deps |
| `uuid` | Document and entity IDs | Standard install |
| `radix-ui`, `@base-ui/react`, `shadcn` | Headless primitives and shadcn tooling | Standard install |
| `@heroicons/react`, `lucide-react` | Icons | Standard install |
| `tailwindcss`, `@tailwindcss/postcss`, `postcss`, `tailwind-merge`, `clsx`, `class-variance-authority`, `tw-animate-css` | Tailwind v4 pipeline and class utilities | Standard install |
| `next-themes` | Light / dark theme switching | Standard install |
| `sonner`, `cmdk`, `embla-carousel-react`, `input-otp`, `react-day-picker`, `react-resizable-panels`, `recharts`, `vaul` | Toasts, command palette, carousel, OTP, calendar, split panels, charts, drawer | Standard install |
| `mammoth`, `unpdf`, `word-extractor` | DOCX / PDF / legacy Word text extraction | `word-extractor` may need build tools on some platforms |
| `tesseract.js` | OCR in the browser | WASM; first use may download assets |
| `heic2any`, `libheif-js` | HEIC / HEIF image handling | Heavier than average |
| `react-dropzone` | Drag-and-drop file uploads | Standard install |
| `date-fns` | Dates (formatting, parsing) | Standard install |

**Development (`devDependencies`):**

| Packages | Role |
| -------- | ---- |
| `typescript`, `@types/node`, `@types/react`, `@types/react-dom`, `@types/uuid`, `@types/word-extractor` | Type checking |
| `eslint`, `eslint-config-next` | Lint (Next.js rules) |
| `prettier` | Formatting (`npm run format`) |
| `vitest` | Unit tests |
| `@playwright/test` | E2E tests |

**If `npm install` fails:**

- Run `npm cache clean --force`, then `npm install` again.
- Ensure Node.js 18+ is installed: `node -v`.
- On Windows, you may need to run the terminal as Administrator for native modules.

### 3. Environment variables

Optional. Copy `.env.local.example` to `.env.local` when you add OCR, LLM, or other API keys:

```bash
cp .env.local.example .env.local
```

Set keys as needed for active integrations:

| Variable | Purpose |
| -------- | ------- |
| `HF_TOKEN` | Hugging Face token for **Ask (Q&A)** and **Summarize** (Inference Providers / router). Optional for **Translate**; when set it is forwarded as `Authorization` on Space calls used by Translate. |
| `HF_TTS_SPACE_URL` | Base URL of the Hugging Face Space for **Read Aloud** (`/api/tts`); requests go to `{base}/synthesize`. |
| `COQUI_TTS_FEMININE_SPEAKER`, `COQUI_TTS_MASCULINE_SPEAKER` | TTS Space provider: English VCTK speaker IDs (defaults `p228` / `p226` if unset). |
| `HF_ASK_BASE_URL` | Optional override for Ask’s OpenAI-compatible API base (default `https://router.huggingface.co/v1`; use a custom Inference Endpoint base when needed). |
| `ASK_LANGSMITH_RECORD_IO` | LangSmith Ask export: when `true`, can record fuller I/O (staging/eval only). |
| `HF_TRANSLATE_SPACE_URL` | Base URL only (no path) of the NLLB **Translate** Gradio Space; required for non-English translation targets (`/api/translate`). |
| `HF_ASK_MODEL` | Optional Ask **model id** override if the default router model is unavailable (see [`app/api/ask/route.ts`](app/api/ask/route.ts)). |
| `LANGSMITH_TRACING` | Set to `true` to export completed **Ask** runs to LangSmith (requires API key; see [`lib/langsmithAskRun.ts`](lib/langsmithAskRun.ts)). |
| `LANGSMITH_API_KEY` | LangSmith secret used when tracing is enabled (`LANGCHAIN_API_KEY` is also honored as a fallback). |
| `LANGSMITH_PROJECT` | LangSmith **project name** used to bucket Ask traces in the LangSmith UI. |
| `HF_SUMMARIZE_MODEL` | Optional **Summarize** model override ([`app/api/summarize/route.ts`](app/api/summarize/route.ts)). |
| `OPEN_ROUTER_API_TOKEN` | **Safety** upstream classifier ([`app/api/safety/route.ts`](app/api/safety/route.ts)). |
| `PLAYWRIGHT_BASE_URL`, `CI` | Tests only (Playwright config). |


### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Verify setup

- The app should load without errors.
- API routes are stateless — they process and return; no server storage.
- Read Aloud requires `HF_TTS_SPACE_URL` to be set (see [Text-to-Speech](#text-to-speech--read-aloud)).
- Translation (non-English targets) requires `HF_TRANSLATE_SPACE_URL` pointing at the NLLB Gradio Space (see [Translation](#translation)).
- Safety route may require `OPEN_ROUTER_API_TOKEN` if used.

### Onboarding checklist

Before you start contributing, confirm:

- [ ] Node.js 18+ installed (`node -v`)
- [ ] Repo cloned and `npm install` completed
- [ ] `npm run dev` runs and [localhost:3000](http://localhost:3000) loads
- [ ] You know your team's area (see [Team ownership](#team-ownership--areas-of-work) below)

### Available scripts

| Command              | Description                           |
| -------------------- | ------------------------------------- |
| `npm run dev`        | Start development server (hot reload) |
| `npm run build`      | Build for production                  |
| `npm run start`      | Start production server               |
| `npm run lint`       | Run ESLint                            |
| `npm run format`     | Check formatting with Prettier        |
| `npm run typecheck`  | Run TypeScript type checking          |
| `npm run test`       | Run tests with Vitest                 |
| `npm run test:watch` | Run tests in watch mode               |

### Linting & Formatting

This project uses ESLint, Prettier, and TypeScript. These checks run in CI.

```bash
npm run lint
npm run format
npx prettier --write .   # Fix formatting
npm run typecheck
```

### Troubleshooting

| Issue                             | Solution                                                                      |
| --------------------------------- | ----------------------------------------------------------------------------- |
| Port 3000 in use                  | Run `npm run dev -- -p 3001` to use a different port                          |
| Build fails                       | Run `npm ci` for a clean install, then `npm run build`                        |
| EntityDB / Transformers.js errors | Check `next.config.js` has webpack aliases for `onnxruntime-node` and `sharp` |
| Translation fails                 | Verify `HF_TRANSLATE_SPACE_URL` is set to the NLLB Gradio Space base URL (see [Translation](#translation)). The route makes a two-step call to `/gradio_api/call/translate` (POST, then GET by `event_id`). Free Spaces sleep after ~48h idle; the first request after sleep can take 30–60s while it cold-starts, and the route waits up to 180s for the full round-trip. `HF_TOKEN` is optional for Translate. |
| Read Aloud fails                  | Confirm `HF_TTS_SPACE_URL` is set and the Space is reachable. Cold starts after idle can take 30–60s. Read Aloud is only offered for English, Spanish, and Vietnamese. |
| Upload rejected around 5–10MB     | Backend limit is 4.5MB `(lib/constants.ts)`                                   |

## Architecture: Zero-retention

```
User Browser
│
├── EntityDB (IndexedDB + Transformers.js)
│   Entities: Document, OCRBlock, Chunk, Embedding, Summary, ChatSession, ChatMessage, RiskFlag, Language
│
└── API requests
     │
     ▼
Stateless Backend (OCR, LLM, embeddings, translation, risk classification)
```

**Server never stores documents.** Everything persistent lives in EntityDB in the browser.

---

## Entity model

```
Document (root)
├── OCRBlock → FieldCandidate
├── Chunk → Embedding
├── Summary
├── RiskFlag
├── Language
└── ChatSession → ChatMessage
```

See `types/index.ts` for full definitions.

---

## Project structure

```
app/
  page.tsx, layout.tsx, globals.css
  dashboard/          # Landing / hub (tabs include Translate card, etc.)
  document/[id]/      # Document detail — extracted fields & “form to complete” (`ExtractedDataPanel`)
  translate/[id]/     # Translate session UI: translation, summary, Ask, Detect, Read Aloud
  actions/logging.ts  # Server action(s) for client logging hooks
  api/
    documents/upload       # Stateless: OCR → JSON + doc identifiers
    documents/extract      # Stateless: OCR → normalized entities
    ask                    # Stateless: streaming Q&A / RAG (client sends chunks or context)
    summarize              # Stateless: summary (`fullText`)
    translate              # Stateless: NLLB via Hugging Face Gradio Space
    tts                    # Stateless: Read Aloud (HF Space, en / es / vi)
    safety                 # Stateless: risk classification (OpenRouter-backed)
    upload                 # Placeholder route (minimal stub)
components/
  ui/                 # Shared primitives (shadcn-style)
  features/ask, detect, document, summary, tts/
  upload-form.tsx
hooks/                # useDocumentSession, useChatHistory, useSafetyAnalysis, …
lib/
  documents/          # OCR pipeline — Team 1
    provider.ts       # OCR provider interface and implementations
    normalize.ts      # Raw OCR → canonical entities
    fieldCandidates.ts # Key/value extraction from OCR blocks
    validation.ts     # Upload validation and guards
    errors.ts         # Shared error helpers
  guardrails/         # Sanitization, TTS / translate hardening, circuit breaker, schemas
  translation/        # NLLB language map, upstream calls, SSE response parsing
  tts/                # router.ts, preprocess.ts, providers/hf-space.ts
  chunking.ts         # Text splitting for embeddings
  entitydb.ts         # IndexedDB EntityDB client (chunks, embeddings, search)
  entitydb-persist.ts # Persist OCR/session into EntityDB entities
  constants.ts        # Limits, MIME allowlists
  documentId.ts       # Stable document IDs
  askGuardrails.ts, askConfidenceBands.ts, askDetectAnswerLanguage.ts
  langsmithAskRun.ts  # Optional LangSmith exports for Ask
  pdfExtract.ts, safetyClient.ts, utils.ts
types/                # Entities (Document, OCRBlock, …) and ambient typings (*.d.ts)
```

---

## API endpoints


| Endpoint                 | Method | Body                                                | Description                                     |
| ------------------------ | ------ | --------------------------------------------------- | ----------------------------------------------- |
| `/api/documents/upload`  | POST   | `FormData` (file)                                   | OCR, return docId + OCR JSON                    |
| `/api/documents/extract` | POST   | `FormData` (files[] or file)                        | OCR, return normalized entity-ready JSON        |
| `/api/translate`           | POST   | `{ text, targetLang }`                              | Translation via NLLB-200 on a public Hugging Face Space |
| `/api/tts`                 | POST   | `{ text, targetLang, gender }`                       | TTS via Hugging Face Space (en/es/vi)           |
| `/api/ask`               | POST   | `{ question, context? }` or `{ question, chunks? }` | RAG answer                                      |
| `/api/summarize`         | POST   | `{ fullText }`                                      | Summary                                         |
| `/api/safety`            | POST   | `{ fullText?, blocks? }`                            | Risk flags                                      |

---

### Documents upload

`POST /api/documents/upload` accepts a single file in **`multipart/form-data`** (`file` field). It is **stateless**: the server extracts text, returns a generated `docId` and an **OCR-shaped JSON** payload (one block containing the full extracted string), and **stores nothing**. The client typically keeps the response in `sessionStorage` for the translate flow.

#### Behavior

- **Extraction** — Text is pulled from **PDF** (`lib/pdfExtract`), **TXT**, **DOCX** (mammoth), or **legacy DOC** (word-extractor). **Images** (JPEG/PNG/WebP) are allowed by MIME allowlist but **text extraction is not implemented** for images; the handler returns a **400** with a clear message.
- **Limits** — Enforces `MAX_FILE_SIZE_BYTES` and `ALLOWED_MIME_TYPES` from `lib/constants.ts` (see [Storage limits](#storage-limits)).
- **Response shape** — Returns `docId`, `filename`, `mimeType`, `sizeBytes`, `createdAt`, and `ocr` (`OCRResult` with a single synthetic block and `language: 'en'`).
- **Errors** — **400** when no file, file too large, disallowed MIME type, extraction failure, or no readable text; **500** on unexpected server errors.

#### Key files

| File | Purpose |
| ---- | ------- |
| `app/api/documents/upload/route.ts` | FormData parsing, validation, extraction orchestration, JSON response |
| `lib/pdfExtract.ts` | PDF text extraction |
| `lib/documentId.ts` | `generateDocumentId()` |
| `lib/constants.ts` | Size and MIME limits shared with extract path |

---

### Documents extract

`POST /api/documents/extract` is the Team 1 **OCR pipeline** endpoint. Accepts **`files[]`** or **`file`** in `multipart/form-data`, runs the configured **`OCRProvider`** per file, **normalizes** results to canonical entities, derives **field candidates**, and returns entity-ready JSON for the client to persist in **EntityDB**. **Nothing is stored on the server.**

#### Behavior

- **Validation** — `parseAndValidateFiles()` in `lib/documents` enforces MIME, size, and max file count (`MAX_FILES_PER_REQUEST`). Failures map to typed **400** responses (`noFilesError`, `invalidFileTypeError`, etc.).
- **OCR** — `getOCRProvider().extract()` per file; failures return **`ocr_failure`** style errors with filename context.
- **Output** — `ExtractionResponse`: `document`, `ocr`, `files`, `fieldCandidates`, `extractedAt`.
- **Errors** — **400** family for validation/OCR failures; **`internalError`** (**500**) on unexpected exceptions in the outer handler.

#### Key files

| File | Purpose |
| ---- | ------- |
| `app/api/documents/extract/route.ts` | Validates multipart input, orchestrates OCR → normalize → field candidates |
| `lib/documents/index.ts` | Barrel: validation helpers, OCR provider accessors, normalization, errors |
| `lib/documents/provider.ts` | `OCRProvider` interface + implementations (e.g. mock / server OCR) |
| `lib/documents/normalize.ts` | Raw OCR → `Document`, `OCRResult`, file metadata |
| `lib/documents/fieldCandidates.ts` | Regex-style field candidates from OCR blocks |
| `lib/documents/validation.ts` | Multipart parsing and file guards |

---

### Ask (Q&A)

`POST /api/ask` provides **streaming document Q&A**: the client performs **retrieval** in the browser (EntityDB chunks), then sends **`question`** plus either **`chunks[]`** or a single **`context`** string and optional **`answerLanguage`** (`es` \| `en` \| `vi`). The server concatenates context, applies **guardrails**, and streams tokens via the **Vercel AI SDK** (`streamText`) to an OpenAI-compatible **Hugging Face Inference Providers** router using **`HF_TOKEN`**.

#### Behavior

- **Configuration** — Without **`HF_TOKEN`**, returns **503** with a setup hint (logged once at module load too).
- **Input** — **400** if `question` is missing or empty after checks. **`context`** defaults to **`chunks.join('\n\n')`** when provided.
- **Guardrails** — `sanitizeAskInputs` / `validateAskRequestInputs` in `lib/askGuardrails.ts` (length caps, sanitization).
- **Model** — `createOpenAI` pointed at **`HF_ASK_BASE_URL`** or `https://router.huggingface.co/v1`, **`HF_ASK_MODEL`** or default Llama router id (`app/api/ask/route.ts`).
- **Streaming** — Success path returns **`toUIMessageStreamResponse()`** for the Ask UI (`AskTab`).
- **Observability** — On completion, optionally posts a run to **LangSmith** when tracing env is configured (`lib/langsmithAskRun.ts`).
- **Errors** — **400** from validation; **503** missing token; **500** JSON/stream setup failures (“Question answering failed”).

#### Key files

| File | Purpose |
| ---- | ------- |
| `app/api/ask/route.ts` | Request parsing, HF model wiring, streaming, LangSmith hook |
| `lib/askGuardrails.ts` | Sanitization and validation |
| `lib/askConfidenceBands.ts` | Overlap thresholds aligned with UI trust cues (referenced in system prompt) |
| `lib/askDetectAnswerLanguage.ts` | Used by client; server honors `answerLanguage` in prompt |
| `lib/langsmithAskRun.ts` | Optional LangSmith export after stream finishes |

---

### Summarize

`POST /api/summarize` returns a **plain JSON** summary for **`fullText`**. Uses **Hugging Face** `POST https://router.huggingface.co/v1/chat/completions` with **`HF_TOKEN`** and optional **`HF_SUMMARIZE_MODEL`** (defaults to the same Llama router id pattern as Ask). **`outputLanguage`** adds a directive so the summary can match translate-UI locales.

#### Behavior

- **Guardrails** — **400** for bad JSON shape / missing **`fullText`**; **422** when text exceeds **100,000** characters or when **regex PII detectors** fire (phones, emails, cards, credentials, etc. — see route for pattern list).
- **Configuration** — **500** if **`HF_TOKEN`** is unset, or summarization prompt file cannot be read.
- **Upstream** — **502** when the provider returns non-JSON or **`!response.ok`**; **500** when the response parses but **`choices[0].message.content`** is empty.
- **State** — Stateless; prompt text from **`app/api/summarize/summarizationPrompt.txt`**.

#### Key files

| File | Purpose |
| ---- | ------- |
| `app/api/summarize/route.ts` | Validation, sensitive-info scan, HF chat completion call |
| `app/api/summarize/summarizationPrompt.txt` | Base system instructions for summarization |

---

### Safety

`POST /api/safety` classifies uploaded document content for **risk flags** and **recommendations**. The client sends either **`fullText`** or OCR **`blocks`** (joined server-side), plus optional **`fieldCandidates`**. Inputs are sanitized in **`app/api/safety/guardrails.ts`**. The route calls **OpenRouter** `POST https://openrouter.ai/api/v1/chat/completions` using **`OPEN_ROUTER_API_TOKEN`** (model **`openrouter/free`**) with a filesystem **system prompt** (`system-prompt.md`).

#### Behavior

- **Validation** — **400** invalid JSON or missing **`fullText` / usable `blocks`**. Guardrail failures return **`VALIDATION_ERROR`** with route-specific statuses.
- **Configuration** — **500** when **`OPEN_ROUTER_API_TOKEN`** is unset (response `code: CONFIG_ERROR`); **500** if the system prompt file is missing or the model returns no parseable assistant content.
- **Upstream** — **502** when OpenRouter returns an HTTP error (response `code: UPSTREAM_ERROR`); **500** / **502** for fetch/parse failures as coded in the handler.
- **Output** — **200** JSON **`{ flags, presentation }`** after parsing structured JSON from the model reply (`lib/safetyRecommendations.ts`, `lib/safetyNextSteps.ts` helpers).

#### Key files

| File | Purpose |
| ---- | ------- |
| `app/api/safety/route.ts` | Request handling, OpenRouter fetch, parsing, response shaping |
| `app/api/safety/guardrails.ts` | Safety-specific sanitization and validation |
| `app/api/safety/system-prompt.md` | Model system instructions |
| `lib/safetyRecommendations.ts` | Recommendation copy and normalization |
| `lib/safetyNextSteps.ts` | Severity / next-step helpers |

---

### Upload placeholder

`POST /api/upload` is a **minimal stub** (returns **`{ success: true }`**). Prefer **`/api/documents/upload`** or **`/api/documents/extract`** for real flows until this route is implemented.

---

### Translation

`/api/translate` translates document text from **English** to **Spanish** or **Vietnamese** using Meta's **NLLB-200** model hosted on a public **Hugging Face Gradio Space** (`Resilient-Coders/nllb-translator`). Source language is fixed to English per product requirements; target codes are FLORES tags defined in `lib/translation/nllbLanguageMap.ts` (the single source of truth shared with the translate UI).

#### Behavior

- **English short-circuit** — `targetLang === 'en'` returns the input text unchanged without any upstream call (no URL needed, no cold start).
- **Non-English** — requires `HF_TRANSLATE_SPACE_URL` (the Space base URL) and calls the Gradio API in two steps: `POST {base}/gradio_api/call/translate` with body `{"data":[text, "eng_Latn", tgt_lang]}` returns an `event_id`, then `GET {base}/gradio_api/call/translate/{event_id}` streams back an SSE `event: complete` frame whose `data:` line is a JSON array `[translated_text]`. The response is parsed by `lib/translation/parseNllbResponse.ts`.
- **Auth** — `HF_TOKEN` is **optional**. The Space is public, so no `Authorization` header is sent when `HF_TOKEN` is empty. If `HF_TOKEN` is set (for Ask / Summary), the route forwards it as a Bearer token on both calls, which the Space ignores.
- **Timeout** — a single 180s `AbortController` bounds the full two-step round-trip to absorb Hugging Face cold starts. Free Spaces sleep after ~48h idle; the first request after sleep can take 30–60s.
- **Errors** — `400` for validation (missing/empty `text`, missing/unsupported `targetLang`), `503` when `HF_TRANSLATE_SPACE_URL` is missing or the network is unreachable, `502` for upstream HTTP errors on either step / empty or malformed SSE responses / timeouts. The route never logs the token or full `text`, only status + short upstream snippet (tagged `POST:` or `SSE:` so you can tell which step failed).

#### Key files

| File | Purpose |
| ---- | ------- |
| `app/api/translate/route.ts` | Next.js POST handler — validates input, English short-circuit, error mapping |
| `lib/translation/callTranslateProvider.ts` | Wraps the upstream `fetch`, timeout, and typed `TranslateProviderError` so tests mock one function instead of global `fetch` |
| `lib/translation/nllbLanguageMap.ts` | `APP_TO_NLLB_TARGET` FLORES mapping + `NLLB_SOURCE_ENGLISH` |
| `lib/translation/parseNllbResponse.ts` | `extractTranslatedTextFromNllbResponse()` for Inference-shaped JSON |

---

### Text-to-Speech / Read Aloud

Read Aloud converts document text to speech so users can listen to original or translated content. It is powered by a single backend: a **Hugging Face Space** running Coqui TTS models.

#### Supported languages

| Language   | Model on the Space                   | Voice selection      |
| ---------- | ------------------------------------ | -------------------- |
| English    | `Resilient-Coders/coqui-vctk-en`    | Gender picker (VCTK multi-speaker: `p228` feminine, `p226` masculine) |
| Spanish    | `Resilient-Coders/coqui-css10-es`   | Single voice (one-click generate) |
| Vietnamese | `Resilient-Coders/mms-tts-vie`      | Single voice (one-click generate) |

If the document's language is not one of these three, the Read Aloud button is hidden in the UI — no error, just no button.

#### Architecture

```
Browser (ReadAloudPanel)
  │  POST /api/tts  { text, targetLang, gender }
  ▼
Next.js route (app/api/tts/route.ts)
  │  validates input, calls synthesizeSpeech()
  ▼
lib/tts/router.ts
  │  normalizes lang, delegates to hf-space provider
  ▼
lib/tts/providers/hf-space.ts
  │  POST https://<HF_TTS_SPACE_URL>/synthesize
  │  body: { text, language, speaker_idx? }
  ▼
Hugging Face Space (resilient-coders-aidoc-tts)
  │  Loads the model for the requested language,
  │  runs inference, returns audio/wav
  ▼
Audio returned to browser → auto-plays via TtsPlaybackVisual
```

There is **no fallback chain** — if the Space is down or the language is unsupported, the request errors and the user sees an error message.

#### Cold starts

The Space runs on Hugging Face's free tier. After ~48 hours of idle, the Space sleeps. The first request after sleep triggers a cold start that can take **30–60 seconds**. The client-side timeout is set to 180 seconds to absorb this. Subsequent requests while the Space is warm are fast (a few seconds).

#### Key files

| File | Purpose |
| ---- | ------- |
| `lib/tts/providers/hf-space.ts` | Calls the Space's `/synthesize` endpoint, handles timeouts and errors |
| `lib/tts/router.ts` | Entry point — normalizes language, delegates to the HF Space provider |
| `lib/tts/types.ts` | `TtsProvider`, `Gender`, `TtsRequestPayload`, `TtsSynthesisResult`, `TtsError` |
| `app/api/tts/route.ts` | Next.js POST handler — validates input, returns audio with `X-TTS-Provider` / `X-TTS-Model` headers |
| `components/features/tts/ReadAloudPanel.tsx` | Client UI — gender dialog for English, one-click for es/vi, playback |
| `components/features/tts/TtsPlaybackVisual.tsx` | Audio player with waveform-style visual sync |

---

## Storage limits

- PDF / Images: ≤ 4.5 MB (client upload limit)

---

## Architecture docs

- [EntityDB (GitHub)](https://github.com/babycommando/entity-db)
