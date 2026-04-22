# Multilingual AI Document Assistant

Privacy-first document assistant with **zero-retention** architecture. Documents are processed but **never stored on servers**. All persistent data lives in the user's browser (EntityDB). Backend is stateless.

**Key points:**

- **No Redis** — server stores nothing
- **No raw IndexedDB** — we use EntityDB instead
- **EntityDB** — IndexedDB under the hood + Transformers.js for embeddings and semantic search
- **Stateless API pattern** — routes process and return results without database persistence

---

## Local Setup / Onboarding

Use this guide to get set up locally and ready to contribute.

**Quick start (copy & paste):**

```bash
git clone https://github.com/Resilient-Labs/multilingual-ai-document-assistant.git
cd multilingual-ai-document-assistant
npm install
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

| Package                      | What it does                                                      | Install notes                           |
| ---------------------------- | ----------------------------------------------------------------- | --------------------------------------- |
| `next`, `react`, `react-dom` | Next.js app framework                                             | Standard install                        |
| `@babycommando/entity-db`    | In-browser vector DB (IndexedDB + Transformers.js under the hood) | May take 1–2 min; pulls WASM deps       |
| `uuid`                       | Document ID generation                                            | Standard install                        |

**Step-by-step:**

1. Open a terminal in the project folder.
2. Run `npm install`.
3. Wait for it to finish (entity-db can take longer on first install).
4. Confirm: you should see `added X packages` and no errors.
5. If it fails, try `npm ci` for a clean install.

**Installing a single package later:**

```bash
npm install <package-name>
```

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

- `HF_TOKEN` (Ask and Summary; optional for Translate — see [Translation](#translation) below)
- `HF_TRANSLATE_SPACE_URL` (Translate — public Hugging Face Gradio Space base URL, see [Translation](#translation) below)
- `OPEN_ROUTER_API_TOKEN` (safety route)
- `HF_TTS_SPACE_URL` (Read Aloud — see [Text-to-Speech](#text-to-speech--read-aloud) below)

No Redis or server storage is required. Add keys only when integrating external services.

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

### Key dependencies

```bash
npm install uuid
npm install github:babycommando/entity-db
```

| Package                   | Purpose                                                      | Install source |
| ------------------------- | ------------------------------------------------------------ | -------------- |
| `@babycommando/entity-db` | In-browser vector DB for chunks, embeddings, semantic search | GitHub         |
| `uuid`                    | Document ID generation (`doc_${uuidv4()}`)                   | npm            |

**EntityDB** stores all data in the browser. Use `lib/entitydb.ts`:

```js
import { insertChunk, queryChunks } from '@/lib/entitydb'

await insertChunk('Document text here', { docId: 'doc_123', chunkId: 'c1' })
const results = await queryChunks('search query', { limit: 5 })
```

---

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

## Team ownership / areas of work

| Team       | Area             | Files / endpoints                                       | What to build                                                                        |
| ---------- | ---------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **Team 1** | Upload & OCR     | `app/api/documents/upload`, `app/api/documents/extract` | File upload, OCR pipeline. Return JSON. Client stores in EntityDB.                   |
| **Team 2** | Summarization    | `app/api/summarize`                                     | Receive `fullText`, return summary via LLM. Stateless.                               |
| **Team 3** | RAG & embeddings | `app/api/ask`, `lib/entitydb.ts`                        | Chunking, embeddings in EntityDB, RAG. Client sends context; backend returns answer. |
| **Team 4** | Multilingual     | (to be added)                                           | Speech-to-text, translation, multilingual responses.                                 |
| **Team 5** | Safety detection | `app/api/safety`                                        | Receive text/blocks, return risk flags. Stateless.                                   |

**Shared resources:**

- `types/` — Entity definitions (Document, OCRBlock, Chunk, etc.)
- `lib/entitydb.ts` — EntityDB client for chunks and semantic search
- `lib/constants.ts` — File limits, allowed MIME types
- `lib/documentId.ts` — Document ID generation

---

## Project structure

```
app/
  api/
    documents/upload   # Stateless: OCR, return JSON
    documents/extract  # Stateless: OCR, return normalized entity-ready JSON
    ask               # Stateless: RAG (client sends context)
    summarize         # Stateless: summary (client sends fullText)
    safety            # Stateless: risk flags (client sends text)
components/           # Shared React components
lib/
  documents/          # Team 1 OCR extraction pipeline
    provider.ts       # OCR provider interface and mock implementation
    normalize.ts      # Raw OCR to canonical entity normalization
    fieldCandidates.ts # Key/value field extraction
    validation.ts     # Upload validation and request guards
    errors.ts         # Shared error response helpers
  tts/                # TTS router + HF Space provider (en/es/vi)
  entitydb.ts         # EntityDB client for chunks and semantic search
  constants.ts        # File limits, allowed MIME types
  documentId.ts       # Document ID generation
types/                # Entity definitions (Document, OCRBlock, FieldCandidate, etc.)
```

---

## API endpoints

All endpoints are **stateless**. Client sends data; backend processes and returns. No server storage.

| Endpoint                 | Method | Body                                                | Description                                     |
| ------------------------ | ------ | --------------------------------------------------- | ----------------------------------------------- |
| `/api/documents/upload`  | POST   | `FormData` (file)                                   | OCR, return docId + OCR JSON                    |
| `/api/documents/extract` | POST   | `FormData` (files[] or file)                        | OCR, return normalized entity-ready JSON        |
| /api/translate           | POST   | `{ text, targetLang }`                              | Translation via NLLB-200 on a public Hugging Face Space |
| /api/tts                 | POST   | `{ text, targetLang, gender }`                       | TTS via Hugging Face Space (en/es/vi)           |
| `/api/ask`               | POST   | `{ question, context? }` or `{ question, chunks? }` | RAG answer                                      |
| `/api/summarize`         | POST   | `{ fullText }`                                      | Summary                                         |
| `/api/safety`            | POST   | `{ fullText?, blocks? }`                            | Risk flags                                      |

---

## Translation

`/api/translate` translates document text from **English** to **Spanish** or **Vietnamese** using Meta's **NLLB-200** model hosted on a public **Hugging Face Gradio Space** (`Resilient-Coders/nllb-translator`). Source language is fixed to English per product requirements; target codes are FLORES tags defined in `lib/translation/nllbLanguageMap.ts` (the single source of truth shared with the translate UI).

### Behavior

- **English short-circuit** — `targetLang === 'en'` returns the input text unchanged without any upstream call (no URL needed, no cold start).
- **Non-English** — requires `HF_TRANSLATE_SPACE_URL` (the Space base URL) and calls the Gradio API in two steps: `POST {base}/gradio_api/call/translate` with body `{"data":[text, "eng_Latn", tgt_lang]}` returns an `event_id`, then `GET {base}/gradio_api/call/translate/{event_id}` streams back an SSE `event: complete` frame whose `data:` line is a JSON array `[translated_text]`. The response is parsed by `lib/translation/parseNllbResponse.ts`.
- **Auth** — `HF_TOKEN` is **optional**. The Space is public, so no `Authorization` header is sent when `HF_TOKEN` is empty. If `HF_TOKEN` is set (for Ask / Summary), the route forwards it as a Bearer token on both calls, which the Space ignores.
- **Timeout** — a single 180s `AbortController` bounds the full two-step round-trip to absorb Hugging Face cold starts. Free Spaces sleep after ~48h idle; the first request after sleep can take 30–60s.
- **Errors** — `400` for validation (missing/empty `text`, missing/unsupported `targetLang`), `503` when `HF_TRANSLATE_SPACE_URL` is missing or the network is unreachable, `502` for upstream HTTP errors on either step / empty or malformed SSE responses / timeouts. The route never logs the token or full `text`, only status + short upstream snippet (tagged `POST:` or `SSE:` so you can tell which step failed).

### Environment variables

| Variable | Required | Default | Description |
| -------- | -------- | ------- | ----------- |
| `HF_TRANSLATE_SPACE_URL` | **Yes** for non-English | — | Base URL of the NLLB Gradio Space (e.g. `https://resilient-coders-nllb-translator.hf.space`). The route appends `/gradio_api/call/translate` and `/{event_id}` itself — do **not** include a path suffix. The route returns 503 when unset or whitespace-only. |
| `HF_TOKEN` | No | — | Optional for Translate (the Space is public). Same token as Ask / Summary; forwarded as `Authorization: Bearer …` when present. |

### Key files

| File | Purpose |
| ---- | ------- |
| `app/api/translate/route.ts` | Next.js POST handler — validates input, English short-circuit, error mapping |
| `lib/translation/callTranslateProvider.ts` | Wraps the upstream `fetch`, timeout, and typed `TranslateProviderError` so tests mock one function instead of global `fetch` |
| `lib/translation/nllbLanguageMap.ts` | `APP_TO_NLLB_TARGET` FLORES mapping + `NLLB_SOURCE_ENGLISH` |
| `lib/translation/parseNllbResponse.ts` | `extractTranslatedTextFromNllbResponse()` for Inference-shaped JSON |

---

## Text-to-Speech / Read Aloud

Read Aloud converts document text to speech so users can listen to original or translated content. It is powered by a single backend: a **Hugging Face Space** running Coqui TTS models.

### Supported languages

| Language   | Model on the Space                   | Voice selection      |
| ---------- | ------------------------------------ | -------------------- |
| English    | `Resilient-Coders/coqui-vctk-en`    | Gender picker (VCTK multi-speaker: `p228` feminine, `p226` masculine) |
| Spanish    | `Resilient-Coders/coqui-css10-es`   | Single voice (one-click generate) |
| Vietnamese | `Resilient-Coders/mms-tts-vie`      | Single voice (one-click generate) |

If the document's language is not one of these three, the Read Aloud button is hidden in the UI — no error, just no button.

### Architecture

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

### Environment variables

| Variable | Required | Default | Description |
| -------- | -------- | ------- | ----------- |
| `HF_TTS_SPACE_URL` | **Yes** | — | Base URL of the Hugging Face Space (e.g. `https://resilient-coders-aidoc-tts.hf.space`) |
| `COQUI_TTS_FEMININE_SPEAKER` | No | `p228` | VCTK speaker ID for feminine English voice |
| `COQUI_TTS_MASCULINE_SPEAKER` | No | `p226` | VCTK speaker ID for masculine English voice |

No other API keys are needed for TTS — the Space is a public Hugging Face deployment with no authentication.

### Cold starts

The Space runs on Hugging Face's free tier. After ~48 hours of idle, the Space sleeps. The first request after sleep triggers a cold start that can take **30–60 seconds**. The client-side timeout is set to 180 seconds to absorb this. Subsequent requests while the Space is warm are fast (a few seconds).

### Key files

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

## Privacy

Documents are processed but never stored on servers. All data stays in the user's browser.

---

## Architecture docs

- [Notion: New Architecture](https://www.notion.so/New-Architecture-31e9f8c9b30c80b4ab88f057a4fe4a40)
- [EntityDB (GitHub)](https://github.com/babycommando/entity-db)
