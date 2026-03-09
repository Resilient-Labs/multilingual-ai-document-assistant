# Multilingual AI Document Assistant

Privacy-first document assistant with ephemeral storage. Upload documents (PDF/images), extract text via OCR, generate summaries, ask questions (RAG), and detect red flags. Documents are stored temporarily in Redis and automatically deleted after 7 days.

## Architecture

- **Storage**: Redis with TTL (7 days) — no permanent document storage
- **Client sessions**: IndexedDB (documents, sessions, chatHistory)
- **Backend**: Next.js API routes

## Structure

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

## Setup

1. **Install dependencies**: `npm install`

2. **Configure Redis** (Upstash recommended):
   - Create a Redis database at [upstash.com](https://upstash.com)
   - Copy `.env.local.example` to `.env.local`
   - Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

3. **Run dev server**: `npm run dev`

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
