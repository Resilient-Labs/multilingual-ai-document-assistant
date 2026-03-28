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

| Package | What it does | Install notes |
|---------|--------------|---------------|
| `next`, `react`, `react-dom` | Next.js app framework | Standard install |
| `@babycommando/entity-db` | In-browser vector DB (IndexedDB + Transformers.js under the hood) | May take 1–2 min; pulls WASM deps |
| `uuid` | Document ID generation | Standard install |
| `replicate`	| TTS fallback provider integration | Requires REPLICATE_API_TOKEN at runtime |

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
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (required for production API rate limiting)

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

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (hot reload) |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run format` | Check formatting with Prettier |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run test` | Run tests with Vitest |
| `npm run test:watch` | Run tests in watch mode |

### Linting & Formatting

This project uses ESLint, Prettier, and TypeScript. These checks run in CI.

```bash
npm run lint
npm run format
npx prettier --write .   # Fix formatting
npm run typecheck
```

### Troubleshooting

| Issue | Solution |
|-------|----------|
| Port 3000 in use | Run `npm run dev -- -p 3001` to use a different port |
| Build fails | Run `npm ci` for a clean install, then `npm run build` |
| EntityDB / Transformers.js errors | Check `next.config.js` has webpack aliases for `onnxruntime-node` and `sharp` |
| Translation fails |	Verify DEEPL_API_KEY is set |
| Read Aloud fails	| Verify DEEPGRAM_API_KEY and/or REPLICATE_API_TOKEN are set |
| Upload rejected around 5–10MB	| Backend limit is 4.5MB `(lib/constants.ts)` |

### Key dependencies

```bash
npm install uuid
npm install github:babycommando/entity-db
npm install replicate
```

| Package | Purpose | Install source |
|---------|---------|----------------|
| `@babycommando/entity-db` | In-browser vector DB for chunks, embeddings, semantic search | GitHub |
| `uuid` | Document ID generation (`doc_${uuidv4()}`) | npm |

**EntityDB** stores all data in the browser. Use `lib/entitydb.ts`:

```js
import { insertChunk, queryChunks } from "@/lib/entitydb";

await insertChunk("Document text here", { docId: "doc_123", chunkId: "c1" });
const results = await queryChunks("search query", { limit: 5 });
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

| Team | Area | Files / endpoints | What to build |
|------|------|-------------------|---------------|
| **Team 1** | Upload & OCR | `app/api/documents/extract` (canonical) | File upload, OCR pipeline. Return JSON. Client stores in EntityDB. |
| **Team 2** | Summarization | `app/api/summarize` | Receive `fullText`, return summary via LLM. Stateless. |
| **Team 3** | RAG & embeddings | `app/api/ask`, `lib/entitydb.ts` | Chunking, embeddings in EntityDB, RAG. Client sends context; backend returns answer. |
| **Team 4** | Multilingual | (to be added) | Speech-to-text, translation, multilingual responses. |
| **Team 5** | Safety detection | `app/api/safety` | Receive text/blocks, return risk flags. Stateless. |

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
    documents/extract  # Canonical extraction endpoint (OCR + text extraction)
    documents/upload   # Deprecated wrapper → delegates to /extract
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

| Endpoint | Method | Body | Description |
|----------|--------|------|-------------|
| `/api/documents/extract` | POST | `FormData` (files[] or file) | **Canonical** extraction endpoint — OCR, return normalized entity-ready JSON |
| `/api/documents/upload` | POST | `FormData` (file) | **Deprecated** — thin wrapper that delegates to `/extract`. Will be removed after 2026-06-27. |
| /api/translate	| POST	| `{ text, targetLang }` |	Translation via DeepL |
| /api/tts	| POST | `{ text, targetLang, gender, spanishAccent? }`	| TTS via provider router (Deepgram/XTTS/MiniMax) |
| `/api/ask` | POST | `{ question, context? }` or `{ question, chunks? }` | RAG answer |
| `/api/summarize` | POST | `{ fullText }` | Summary |
| `/api/safety` | POST | `{ fullText?, blocks? }` | Risk flags |

All mutating `/api/*` endpoints are guarded in `middleware.ts` with same-origin CSRF checks. Rate limiting is applied to mutating API requests when Upstash Redis is configured.

---


## Storage limits

- PDF / Images: ≤ 4.5 MB (client upload limit)

---

## Privacy

Documents are processed but never stored on servers. All data stays in the user's browser.

---

## PR: Text chunking utility + EntityDB RAG wiring (Team 3)

**Branch:** `feature/team-3-text-chunking-utility`  
**Range:** `09f36063760fd12014dbcb78d8d8a1e039733627` → `febf8c4d4551a5038421dfc6c084dbddaa07811c` (inclusive)

This section documents what landed on that branch. It is aligned with the **Chunking & Upload Wiring** audit: see `audit-reports/AUDIT-2026-03-27-1430/consolidated/CONSOLIDATED.md`.

### Summary

This work delivers a **text chunking path for RAG**: `chunkText()` lives under `lib/`, runs at persist time, and each chunk is stored via **`insertChunk()`** so EntityDB can embed and serve semantic search. The same commits also **align upload/extraction with the canonical `/api/documents/extract` route**, add **rate limiting** for CPU-heavy extraction, **refactor the upload UI** into a hook plus shared language control, fix **client vs server max file size**, and improve **upload error announcement** for assistive tech.

### Ticket alignment (audit “Top 5”)

| Audit item | What shipped in this range |
|------------|----------------------------|
| Move and wire `lib/chunking.ts`; call `chunkText` on persist; chunks through embedding path | `chunking.ts` moved to `lib/`; `persistOCRToEntityDB` calls `chunkText(fullText)` and `insertChunk` per chunk with `docId` / `chunkId`. |
| Rate limit API endpoints | `middleware.ts`: same-origin CSRF guard for mutating `/api/*` requests and sliding-window rate limiting per client IP when Upstash Redis is configured. |
| Align file size limits (UI vs server) | Dropzone `maxSize` and copy use `MAX_FILE_SIZE_BYTES` from `lib/constants.ts` (4.5 MB), same as the API. |
| `role="alert"` / live region for errors | Error container uses `role="alert"`, `aria-live="assertive"`, `aria-atomic="true"`; styling hides the empty state without removing the live region. |
| Overlap between `/upload` and `/extract` | `/api/documents/upload` is a **deprecated thin wrapper** that delegates to the extract handler and sets `Deprecation`, `Sunset`, and `Link: successor-version` headers; README documents `/extract` as canonical. |

### Implementation details

**Chunking (`lib/chunking.ts`)**

- `chunkText(text, { chunkSize?, chunkOverlap? })` — pure; usable from client or server.
- Defaults: **500** characters per chunk, **100** overlap; stride = `chunkSize - chunkOverlap` (minimum 1).
- Short text: single chunk `chunk_0` after trim; empty input yields `[]`.
- `tokenCount` uses `ceil(length / 4)` (heuristic, not a real tokenizer).

**RAG persistence (`lib/entitydb-persist.ts`)**

After the IndexedDB write for the extracted document payload:

1. Runs `chunkText(params.ocr.fullText)`.
2. For each chunk, `await insertChunk(chunk.text, { docId, chunkId: chunk.id })` so records use `EntityDB.insert()` and the embedding path behind `queryChunks`.

The canonical document row still uses a **placeholder vector** for that record; **chunk rows** back meaningful similarity search.

**Upload / extraction**

- `hooks/useDocumentUpload.ts` — submit, OCR progress, `persistOCRToEntityDB`, session keys, navigation. Images: Tesseract + `prepareImageBytes` in `lib/image-utils.ts` (HEIC/HEIF → JPEG). Documents: `POST /api/documents/extract`, then persist.
- `lib/documents/provider.ts` — default provider is `CompositeOCRProvider` (images → `TesseractOCRProvider`, PDF/DOC/DOCX/TXT → `DocumentTextProvider`).
- `components/upload-form.tsx` — dropzone, `LanguageSelector`, delegates to the hook.
- `app/api/documents/upload/route.ts` — delegates to the extract handler; deprecation headers and console warning.

**Ops / UX**

- `middleware.ts` — in-memory per-IP counters (suitable for single-instance dev; revisit for multi-node deploys).
- `app/page.tsx` — marketing copy uses `maxSizeLabel` from `MAX_FILE_SIZE_BYTES`.

**Process artifacts**

Commit `aca812b` also adds Cursor audit command templates, debug log snapshots, and `audit-reports/AUDIT-2026-03-27-1430/` (consolidated + individual audits). These are documentation/process tooling, separate from runtime behavior.

### Commit log (chronological)

| Commit | Summary |
|--------|---------|
| `09f3606` | Introduces `chunkText` under `multilingual-ai-document-assistant/lib/chunking.ts` (initial location). |
| `aca812b` | Moves `chunking.ts` → `lib/chunking.ts`; wires `persistOCRToEntityDB` to chunk + `insertChunk`; adds audit/Cursor artifacts above. |
| `ce9e1ef` | Rate limiting middleware; README canonical `/extract`; deprecates `/upload`; upload refactor (hook, `LanguageSelector`, `image-utils`); `CompositeOCRProvider` / `DocumentTextProvider`. |
| `febf8c4` | Unifies max file size (dropzone + copy) with `MAX_FILE_SIZE_BYTES`; live region refinement for upload errors; homepage copy uses shared limit. |

### How to verify

1. Upload a long PDF or DOCX → multiple chunk entities; `queryChunks` returns sensible similarity for matching queries.
2. Upload an image → OCR path persists and chunks recognized text.
3. File over 4.5 MB → rejected in dropzone before API.
4. Many rapid `POST /api/documents/extract` calls → 429 after threshold within the window.
5. `POST /api/documents/upload` → same behavior as extract + deprecation headers.

### Files worth a close review

- `lib/chunking.ts`, `lib/entitydb-persist.ts`, `lib/entitydb.ts` (`insertChunk` / `queryChunks`)
- `middleware.ts`
- `hooks/useDocumentUpload.ts`, `lib/documents/provider.ts`
- `app/api/documents/upload/route.ts`

---

## Architecture docs

- [Notion: New Architecture](https://www.notion.so/New-Architecture-31e9f8c9b30c80b4ab88f057a4fe4a40)
- [EntityDB (GitHub)](https://github.com/babycommando/entity-db)