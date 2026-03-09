# Multilingual AI Document Assistant

Privacy-first document assistant with ephemeral storage. Upload documents (PDF/images), extract text via OCR, generate summaries, ask questions (RAG), and detect red flags. Documents are stored temporarily in Redis and automatically deleted after 7 days.

---

## Local Setup / Onboarding

Use this guide to get set up locally and ready to contribute.

**Quick start (copy & paste):**

```bash
git clone https://github.com/devchicajas/test_repo.git
cd test_repo
npm install
cp .env.local.example .env.local
# Edit .env.local and add your Upstash Redis URL + token
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000). For full details, follow the steps below.

---

### Prerequisites

- **Node.js** 18.x or 20.x ([nodejs.org](https://nodejs.org))
- **npm** 9+ (comes with Node.js)
- **Git** (for cloning)

### 1. Clone the repository

```bash
git clone https://github.com/devchicajas/test_repo.git
cd test_repo
```

### 2. Install dependencies

Run the install command from the project root:

```bash
npm install
```

**What this installs:**

| Package | What it does | Install notes |
|---------|--------------|---------------|
| `next`, `react`, `react-dom` | Next.js app framework | Standard install |
| `@upstash/redis` | Redis client for server-side storage | Installs quickly |
| `@babycommando/entity-db` | In-browser vector DB (from GitHub) | May take 1–2 min; pulls Transformers.js and WASM deps |
| `uuid` | Document ID generation | Standard install |

**Step-by-step:**

1. Open a terminal in the project folder.
2. Run `npm install`.
3. Wait for it to finish (entity-db can take longer on first install).
4. Confirm: you should see `added X packages` and no errors.
5. If it fails, try `npm ci` for a clean install.

**Installing a single package later:**

```bash
# Add a new dependency
npm install <package-name>

# Example: add a new utility
npm install zod
```

**If `npm install` fails:**

- Run `npm cache clean --force`, then `npm install` again.
- Ensure Node.js 18+ is installed: `node -v`.
- On Windows, you may need to run the terminal as Administrator for native modules.

### 3. Environment variables

Copy the example env file and add your values:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and set:

| Variable | Description | Where to get it |
|----------|-------------|-----------------|
| `UPSTASH_REDIS_REST_URL` | Redis REST API URL | [Upstash Console](https://console.upstash.com) → Create database → REST API |
| `UPSTASH_REDIS_REST_TOKEN` | Redis REST API token | Same as above |

**Getting Redis credentials (Upstash):**

1. Go to [upstash.com](https://upstash.com) and sign up
2. Create a new Redis database (free tier available)
3. Copy the REST URL and REST Token from the database details

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Verify setup

- The app should load without errors
- API routes will return `503 Storage not configured` until Redis env vars are set
- Once Redis is configured, upload and document endpoints will work

### Onboarding checklist

Before you start contributing, confirm:

- [ ] Node.js 18+ installed (`node -v`)
- [ ] Repo cloned and `npm install` completed
- [ ] `.env.local` created with Redis credentials (or you understand API will return 503 until configured)
- [ ] `npm run dev` runs and [localhost:3000](http://localhost:3000) loads
- [ ] You know your team’s area (see [Team ownership](#team-ownership--areas-of-work) below)

### Available scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (hot reload) |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

### Troubleshooting

| Issue | Solution |
|-------|----------|
| `Redis not configured` | Ensure `.env.local` has both `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` |
| Port 3000 in use | Run `npm run dev -- -p 3001` to use a different port |
| Build fails | Run `npm ci` for a clean install, then `npm run build` |

### Key dependencies

All packages are installed via `npm install` (see step 2 above). To add them manually:

```bash
npm install @upstash/redis uuid
npm install github:babycommando/entity-db
```

| Package | Purpose | Install source |
|---------|---------|----------------|
| `@upstash/redis` | Server-side ephemeral storage (Redis with TTL) | npm |
| `@babycommando/entity-db` | In-browser vector database (IndexedDB + Transformers.js) for client-side embeddings and semantic search | GitHub |
| `uuid` | Document ID generation (`doc_${uuidv4()}`) | npm |

**EntityDB** runs entirely in the browser and can be used for client-side RAG or semantic search. Example:

```js
import { EntityDB } from "@babycommando/entity-db";

const db = new EntityDB({
  vectorPath: "documents",
  model: "Xenova/all-MiniLM-L6-v2",
});
await db.insert({ text: "Document content here" });
const results = await db.query("search query");
```

---

## Team ownership / areas of work

Use this to find what you need to work on and who owns what.

| Team | Area | Files / endpoints | What to build |
|------|------|-------------------|---------------|
| **Team 1** | Upload & OCR | `app/api/documents/upload`, `app/api/documents/extract` | File upload, OCR pipeline, store `doc:{docId}` in Redis |
| **Team 2** | Summarization | `app/api/summarize` | Generate summaries from `fullText` via LLM |
| **Team 3** | RAG & embeddings | `app/api/ask`, `app/api/document/[docId]`, `lib/` | Chunking, embeddings, vector search, RAG prompts |
| **Team 4** | Multilingual | (to be added) | Speech-to-text, translation, multilingual LLM responses |
| **Team 5** | Safety detection | `app/api/safety` | Red-flag detection (scams, eviction notices, urgent docs) |

**Shared resources:**

- `types/` — OCR, chunks, embeddings, IndexedDB schemas
- `lib/redis.ts` — Redis client and helpers
- `lib/indexeddb.ts` — Client session persistence (documents, sessions, chatHistory)
- `lib/constants.ts` — TTL, file limits, Redis key prefixes

---

## Architecture

- **Storage**: Redis with TTL (7 days) — no permanent document storage
- **Client sessions**: IndexedDB (documents, sessions, chatHistory)
- **Backend**: Next.js API routes

## Project Structure

```
app/
  api/
    documents/upload   # Upload + OCR + Redis storage
    documents/extract  # Return OCR JSON
    document/[docId]   # Get document metadata/OCR
    ask               # RAG question answering
    summarize         # Document summarization (Team 2)
    safety            # Red-flag detection (Team 5)
components/           # Shared React components
lib/                  # Redis, constants, documentId, IndexedDB
types/                # OCR, chunks, embeddings, IndexedDB schemas
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/documents/upload` | POST | Upload file, OCR, store in Redis |
| `/api/documents/extract` | POST | Get OCR JSON for a document |
| `/api/document/[docId]` | GET | Get document metadata + OCR |
| `/api/ask` | POST | RAG question answering |
| `/api/summarize` | POST | Generate summary |
| `/api/safety` | POST | Safety/red-flag detection |

## Storage Limits

- PDF / Images: ≤ 4.5 MB
- OCR JSON: ≤ 2 MB
- Chunks + embeddings: ≤ 3 MB

## Privacy

Documents are temporarily stored for processing and automatically deleted after 7 days.
