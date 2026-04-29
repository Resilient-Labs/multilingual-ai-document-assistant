# Multilingual AI Document Assistant

**Privacy-first** and **zero-retention** by design: built for users who rely on translating and making sense of **English-language documents**, it layers translation, summarization, and **RAG-grounded Q&A** so answers trace back to their own pages—not web-scale guesswork—via a multi-model backend. Text is processed on demand and **never stored on servers**; whatever persists stays in the **user’s browser (EntityDB)**. The backend stays **stateless** end to end.

**Key points:**

- **EntityDB** — IndexedDB under the hood + Transformers.js for embeddings and semantic search
- **Stateless API pattern** — routes process and return results without database persistence

---

*Screenshots Here*

---

## Live Demo

[Vercel Deployment](multilingual-ai-document-assistant.vercel.app)

## Local Setup

### Quick start (copy & paste)
*Warning: Still needs .env.local variables*

```bash
git clone https://github.com/Resilient-Labs/multilingual-ai-document-assistant.git
cd multilingual-ai-document-assistant
npm install
npm run build
npm run dev
```

Then open http://localhost:3000
---

#### 1. Clone the repository

```bash
git clone https://github.com/Resilient-Labs/multilingual-ai-document-assistant.git
cd multilingual-ai-document-assistant
```

#### 2. Install dependencies

```bash
npm install
```

#### 3. Optimize the build

```bash
npm run build
```

#### 4. Environment variables

Optional. Copy `.env.local.example` to `.env.local` when you add OCR, LLM, or other API keys:

```bash
cp .env.local.example .env.local
```

#### Important Environment Variables
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

#### 5. Run the development server

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

#### 6. Verify setup

- The app should load without errors.
- API routes are stateless — they process and return; no server storage.
- Read Aloud requires `HF_TTS_SPACE_URL` to be set (see [Text-to-Speech](#text-to-speech--read-aloud)).
- Translation (non-English targets) requires `HF_TRANSLATE_SPACE_URL` pointing at the NLLB Gradio Space.
- Safety route may require `OPEN_ROUTER_API_TOKEN` if used.

### Troubleshooting

| Issue                             | Solution                                                                      |
| --------------------------------- | ----------------------------------------------------------------------------- |
| Port 3000 in use                  | Run `npm run dev -- -p 3001` to use a different port                          |
| Build fails                       | Run `npm ci` for a clean install, then `npm run build`                        |
| EntityDB / Transformers.js errors | Check `next.config.js` has webpack aliases for `onnxruntime-node` and `sharp` |
| Translation fails                 | Verify `HF_TRANSLATE_SPACE_URL` is set to the NLLB Gradio Space base URL Free Spaces sleep after ~48h idle; the first request after sleep can take 30–60s while it cold-starts, and the route waits up to 180s for the full round-trip. `HF_TOKEN` is optional for Translate. |
| Read Aloud fails                  | Confirm `HF_TTS_SPACE_URL` is set and the Space is reachable. Cold starts after idle can take 30–60s. Read Aloud is only offered for English, Spanish, and Vietnamese. |
| Upload rejected around 5–10MB     | Backend limit is 4.5MB `(lib/constants.ts)`                                   |

## Architecture: Zero-retention

**Henry's Diagram**

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

## Storage limits

- PDF / Images: ≤ 4.5 MB (client upload limit)

---

## Architecture docs

- [EntityDB (GitHub)](https://github.com/babycommando/entity-db)