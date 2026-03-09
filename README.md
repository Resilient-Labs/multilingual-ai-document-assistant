# Multilingual AI Document Assistant

Privacy-first document assistant with ephemeral storage. Upload documents (PDF/images), extract text via OCR, generate summaries, ask questions (RAG), and detect red flags. Documents are stored temporarily in Redis and automatically deleted after 7 days.

---

## Local Setup / Onboarding

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

```bash
npm install
```

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
