# Multilingual AI Document Assistant

Privacy-first document assistant with **zero-retention** architecture. Documents are processed but **never stored on servers**. All persistent data lives in the user's browser (EntityDB). Backend is stateless.

**Key points:**
- **No Redis** — server stores nothing
- **No raw IndexedDB** — we use EntityDB instead
- **EntityDB** — IndexedDB under the hood + Transformers.js for embeddings and semantic search

---

## __Important__: This is a test branch
- Must have openrouter api token
```
OPEN_ROUTER_API_TOKEN = <Your api token here>
```

### Important files (edited by Godwin)
- `page.tsx` - main page
- `components/db/DBWidget` - for interacting with entity
- `components/db/AddExampleChunk` - for initializing chunk
- `components/db/UpdateChunk` - for updating chunk in place
- `components/db/ScamTeam` - for reaching our models and updating the DB
- `app/api/test/route` - for testing frontend/backend communication
- `app/api/safety/route` - SCAM TEAM!(api token needed for this one) 

### Important files overall
- `lib/entitydb.ts` - entityDB specific functions


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

No Redis or server storage is required. Add keys only when integrating external services.

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Verify setup

- The app should load without errors.
- API routes are stateless — they process and return; no server storage.

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

### Key dependencies

```bash
npm install uuid
npm install github:babycommando/entity-db
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
| **Team 1** | Upload & OCR | `app/api/documents/upload`, `app/api/documents/extract` | File upload, OCR pipeline. Return JSON. Client stores in EntityDB. |
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
    documents/upload   # Stateless: OCR, return JSON
    documents/extract  # Stateless: OCR, return JSON
    ask               # Stateless: RAG (client sends context)
    summarize         # Stateless: summary (client sends fullText)
    safety            # Stateless: risk flags (client sends text)
components/           # Shared React components
lib/                  # entitydb, constants, documentId
types/                # Entity definitions
```

---

## API endpoints

All endpoints are **stateless**. Client sends data; backend processes and returns. No server storage.

| Endpoint | Method | Body | Description |
|----------|--------|------|-------------|
| `/api/documents/upload` | POST | `FormData` (file) | OCR, return docId + OCR JSON |
| `/api/documents/extract` | POST | `FormData` (file) | OCR, return OCR JSON |
| `/api/ask` | POST | `{ question, context? }` or `{ question, chunks? }` | RAG answer |
| `/api/summarize` | POST | `{ fullText }` | Summary |
| `/api/safety` | POST | `{ fullText?, blocks? }` | Risk flags |

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
