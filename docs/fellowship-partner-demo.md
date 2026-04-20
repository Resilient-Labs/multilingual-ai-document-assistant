# Fellowship hiring partner — demo guide

This document is for **presenters** demoing the Multilingual AI Document Assistant to **hiring partners** (fellowship sponsors, employers, or program staff). Goal: a **10-minute, credible story** about privacy, multilingual value, and working software.

## Partner message (one paragraph you can read aloud)

> This assistant helps people understand government and legal-style documents in **English, Spanish, and Vietnamese**. Documents are **not stored on our servers**—processing happens in the browser and in short, stateless API calls. Users can translate, summarize, listen aloud, and **ask questions** grounded in the text they uploaded.

## Before the demo (same day)

1. **Machine:** Use **desktop Chrome or Edge** (recommended). The main flow is **Upload → Translate**; mobile home still shows placeholder tabs for translate/ask—avoid phone for this demo.
2. **Network:** Stable Wi‑Fi; Hugging Face inference can rate-limit on congested networks.
3. **Environment:** In `.env.local` set at minimum:
   - **`HF_TOKEN`** — powers **Ask (Q&A)** and **Summary** via Hugging Face Inference Providers (same token for both). Without it, Ask returns a clear configuration error.
   - **`DEEPL_API_KEY`** — if you will **translate** in the demo.
   - **`HF_TTS_SPACE_URL`** — if you will demo **Read Aloud** (cold start can take 30–60s after idle).
4. **Smoke:** `npm run typecheck && npm run test:ask` then `npm run dev` — open the app once, upload a **small PDF** (under ~4 MB), complete translate if needed, open **Ask**, send one question, confirm an answer streams.

## Suggested demo script (~8–10 minutes)

| Minute | What you show | What to say (short) |
|--------|----------------|---------------------|
| 0–1 | Home / upload | “Nothing stays on our servers; persistence is in the user’s browser.” |
| 1–4 | Upload a **short** benefits-style or notice PDF | “We OCR and chunk in the browser for search and Q&A.” |
| 4–6 | Translate to **Spanish or Vietnamese** (if DeepL configured) | “Translation is a separate API call; we still keep the doc client-side.” |
| 6–9 | **Ask** — one question in **English**, one in **Spanish** (`¿…?`) | “Answers are grounded in chunks we send; the UI shows trust and sources.” |
| 9–10 | **Summary** or **Read Aloud** (optional) | “Same privacy model—full text sent only for that request.” |

## Sample questions (safe, impressive)

- English: “What is this document mainly about?” or “What should I do next?”
- Spanish: “¿Cuáles son mis derechos según este aviso?” (adjust to your sample doc.)
- Vietnamese: Use a short line from your doc or: “Tóm tắt đoạn đầu bằng tiếng Việt?” only if your pipeline supports it end-to-end.

## If something goes wrong (stay calm)

| Symptom | What to say | Fix |
|---------|-------------|-----|
| Ask: “not configured” / 503 | “We need a Hugging Face token in this environment.” | Set `HF_TOKEN`, restart `npm run dev`. |
| Ask: “busy or rate-limited” | “The free inference tier is throttling; we’ll retry.” | Wait 30s, click **Try again**, or shorten the question. |
| Translate fails | “Translation uses DeepL in this build.” | Set `DEEPL_API_KEY` or skip translate and still demo Ask on **English** doc text. |
| Read Aloud slow | “The TTS Space wakes from sleep.” | Start Read Aloud **once** before partners enter the room. |
| Ask input disabled | “Chunks are still indexing.” | Wait a few seconds on the translate page; see `docs/ask-team-readiness.md`. |

## Honest limitations (if partners ask)

- **Trust colors** are a **lexical overlap** heuristic, not a legal guarantee of accuracy.
- **Very large PDFs** or poor OCR reduce Q&A quality.
- **Mobile** home flow is not the primary demo path yet.

## Deeper technical checklist (internal)

See **`docs/ask-team-readiness.md`** for env details, automated `npm run test:ask`, and known product limits.

## After the demo

- Share this repo and **`docs/ask-team-readiness.md`** (and this file) for technical partners—**`README.md` is not updated on every branch** so we keep partner notes in `docs/`.
- Collect feedback on **who** the product serves first (e.g. benefits notices) — aligns with roadmap.
