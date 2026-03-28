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
| `replicate`                  | TTS fallback provider integration                                 | Requires REPLICATE_API_TOKEN at runtime |

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

- `DEEPL_API_KEY` (translation route)
- `DEEPGRAM_API_KEY` (TTS route)
- `REPLICATE_API_TOKEN` (XTTS + MiniMax TTS fallback)
- `OPEN_ROUTER_API_TOKEN` (safety route)

Optional/advanced TTS variables:

- `XTTS_REPLICATE_MODEL`
- `XTTS_SPEAKER_WAV_URL`
- `MINIMAX_REPLICATE_MODEL`
- `MINIMAX_FEMININE_VOICE_ID`
- `MINIMAX_MASCULINE_VOICE_ID`
- `MINIMAX_AUDIO_FORMAT`

No Redis or server storage is required. Add keys only when integrating external services.

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Verify setup

- The app should load without errors.
- API routes are stateless — they process and return; no server storage.
- TTS and safety require their respective API keys.

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
| Translation fails                 | Verify DEEPL_API_KEY is set                                                   |
| Read Aloud fails                  | Verify DEEPGRAM_API_KEY and/or REPLICATE_API_TOKEN are set                    |
| Upload rejected around 5–10MB     | Backend limit is 4.5MB `(lib/constants.ts)`                                   |

### Key dependencies

```bash
npm install uuid
npm install github:babycommando/entity-db
npm install replicate
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
  tts/                # TTS provider router + mappings + providers
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
| /api/translate           | POST   | `{ text, targetLang }`                              | Translation via DeepL                           |
| /api/tts                 | POST   | `{ text, targetLang, gender, spanishAccent? }`      | TTS via provider router (Deepgram/XTTS/MiniMax) |
| `/api/ask`               | POST   | `{ question, context? }` or `{ question, chunks? }` | RAG answer                                      |
| `/api/summarize`         | POST   | `{ fullText }`                                      | Summary                                         |
| `/api/safety`            | POST   | `{ fullText?, blocks? }`                            | Risk flags                                      |

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
