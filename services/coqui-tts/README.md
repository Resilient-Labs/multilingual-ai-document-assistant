# Local Coqui TTS sidecar

HTTP wrapper around [Coqui TTS](https://github.com/idiap/coqui-ai-TTS) for **English**, **Spanish**, and **Vietnamese** VITS models. Used by the Next.js app's `/api/tts` route when `targetLang` is `en`, `es`, or `vi` (primary provider: `coqui-local`).

Models are **lazy-loaded** on first request per language so startup stays fast; the first Spanish or Vietnamese synthesis may download weights into `~/.local/share/tts/`.

---

## Requirements

- **Python 3.10–3.14** (the community `coqui-tts` fork supports up to 3.14).
- **espeak-ng** — system package required by the VITS/VCTK phonemizer.
  - Arch: `sudo pacman -S espeak-ng`
  - Ubuntu/Debian: `sudo apt install espeak-ng`

---

## Setup

```bash
# 1. Install system dependency first
sudo pacman -S espeak-ng   # Arch
# sudo apt install espeak-ng  # Ubuntu / Debian

# 2. Create venv and install Python deps
cd services/coqui-tts
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

The first synthesis for each language downloads that model (rough sizes below).

---

## Run

```bash
cd services/coqui-tts
source .venv/bin/activate
python server.py
```

Server listens on `http://127.0.0.1:5002`.

- `GET /health` — `status`, `device`, `supported_languages`, `loaded_languages` (models loaded in memory so far)
- `GET /speakers` — list of VCTK speaker IDs for the **English** model (loads English weights if needed)
- `POST /synthesize` — JSON body:
  - `text` (required)
  - `language` — `en` | `es` | `vi` (default `en`)
  - `speaker_idx` — optional; used only when `language` is `en` (VCTK speaker id, e.g. `p228`)

Returns `audio/wav`.

### Health check

```bash
curl http://127.0.0.1:5002/health
# → {"status":"ok","device":"cpu","loaded_languages":[],"supported_languages":["en","es","vi"]}
```

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `COQUI_TTS_URL` | `http://127.0.0.1:5002` | Base URL of the sidecar (read by the Next.js provider). |
| `COQUI_TTS_EN_MODEL` | `tts_models/en/vctk/vits` | English multi-speaker VITS. |
| `COQUI_TTS_ES_MODEL` | `tts_models/es/css10/vits` | Spanish single-speaker VITS. |
| `COQUI_TTS_VI_MODEL` | `tts_models/vie/fairseq/vits` | Vietnamese Fairseq MMS VITS. |
| `COQUI_TTS_FEMININE_SPEAKER` | `p228` | VCTK speaker ID used for the feminine voice (English only). |
| `COQUI_TTS_MASCULINE_SPEAKER` | `p226` | VCTK speaker ID used for the masculine voice (English only). |
| `COQUI_DEFAULT_SPEAKER` | `p228` | Sidecar fallback when `speaker_idx` is omitted for English. |

Set overrides in `.env.local` on the Next.js app for speaker IDs; set model name overrides in the shell environment **for the Python process** (or export before `python server.py`). To browse English speaker IDs: `curl http://127.0.0.1:5002/speakers`

---

## Architecture

The `/api/tts` route uses a **provider router** (`lib/tts/router.ts`). For `en`, `es`, and `vi`, the primary provider is this sidecar. Cloud providers are used if the sidecar fails.

```
ReadAloudPanel
    |
    |  POST /api/tts  { text, targetLang, gender, spanishAccent? }
    v
lib/tts/router.ts  (getTtsProvider)
    |
    +-- en, auto, es, vi --> coqui-local --> services/coqui-tts/server.py
    |                                         (FastAPI, per-language VITS, WAV out)
    |
    +-- en / es fallback: deepgram -> xtts (Replicate)
    |
    +-- vi fallback: minimax -> xtts (Replicate)
```

Other languages still use Deepgram, MiniMax (e.g. `sv`), or XTTS as before.

### How synthesis works

1. The Next.js `coqui-local` provider POSTs `{ text, language, speaker_idx? }` to `/synthesize`.
2. `split_sentences()` breaks the text into ≤200-character chunks, stripping bullet characters and normalising whitespace. This avoids a PyTorch tensor dimension error that occurs when the VITS model receives very long inputs.
3. Each sentence is synthesised individually via `TTS.tts()`, producing a NumPy float32 array (English uses `speaker=...`; Spanish and Vietnamese use the model default voice).
4. All chunks are concatenated and encoded into a single in-memory WAV file.
5. The WAV binary is returned with `Content-Type: audio/wav`.
6. The Next.js provider returns an `ArrayBuffer`; the translate page creates an object URL for the `<audio>` element and the existing `TtsPlaybackVisual` UI renders (waveform, Pause, -5s, Download, speed).

---

## Model details

| Language | Model | Notes |
|----------|--------|--------|
| English (`en`) | `tts_models/en/vctk/vits` | Multi-speaker VCTK (~140 MB first run). |
| Spanish (`es`) | `tts_models/es/css10/vits` | Single speaker (~tens–100+ MB). |
| Vietnamese (`vi`) | `tts_models/vie/fairseq/vits` | Fairseq MMS VITS (~tens–100+ MB). |

Runtime defaults to **CPU** (no GPU required). Inference speed depends on CPU and text length.

---

## Fallback behaviour

| Scenario | Result |
|----------|--------|
| Sidecar running, synthesis succeeds | Audio from local model. `X-TTS-Provider: coqui-local` |
| Sidecar offline (connection refused) | **en / es:** Deepgram (if `DEEPGRAM_API_KEY` set), then XTTS. **vi:** MiniMax (if Replicate configured), then XTTS. |
| Cloud not configured | Next step in chain; eventual error in UI if all fail |
| All providers fail | Error from `/api/tts` shown in Read Aloud UI |

---

## Translate page behaviour

On `app/translate/[id]/page.tsx`, **Read Aloud** on the **Translation** card is shown only when the session target language is **Spanish** or **Vietnamese**, so local TTS matches the languages supported by this sidecar for that panel. The **Original Document** card still offers Read Aloud for the source language (typically English via the same sidecar).

---

## Files touched by the Next.js integration

| File | Role |
|------|------|
| `services/coqui-tts/server.py` | Sidecar (lazy multi-language load). |
| `lib/tts/providers/coqui-local.ts` | HTTP client; sends `language` and optional `speaker_idx`. |
| `lib/tts/router.ts` | Routes `en` / `es` / `vi` / `auto` → `coqui-local` with language-specific fallbacks. |
| `lib/tts/deepgram-voices.test.ts` | Tests for `getTtsProvider`. |
| `components/features/tts/ReadAloudPanel.tsx` | Read Aloud UI (no gender/accent dialog for local `es`/`vi`). |
| `app/translate/[id]/page.tsx` | Translation Read Aloud gated to `es` / `vi`. |
| `.env.local.example` | Optional Coqui URL, speakers, and model name overrides. |

---

## Known limitations / future work

- **Word-level sync is approximate.** `TtsPlaybackVisual` uses character-position estimation, not true forced alignment. A future improvement would return per-word timestamps from the sidecar.
- **Spanish/Vietnamese** use a single fixed voice each in the default models; accent and gender pickers are not used for those in the UI.
- **GPU support.** Change `.to("cpu")` to `.to("cuda")` in `server.py` for faster synthesis if a GPU is available.
- **Single process.** Concurrent requests queue. For production, run multiple uvicorn workers.
