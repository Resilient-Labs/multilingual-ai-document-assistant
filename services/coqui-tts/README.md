# Local Coqui TTS sidecar

HTTP wrapper around [Coqui TTS](https://github.com/idiap/coqui-ai-TTS) for English VITS (`tts_models/en/vctk/vits`). Used by the Next.js app's `/api/tts` route when `targetLang` is `en`.

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

The first synthesis run downloads the VITS/VCTK model (~140 MB) into `~/.local/share/tts/`.

---

## Run

```bash
cd services/coqui-tts
source .venv/bin/activate
python server.py
```

Server listens on `http://127.0.0.1:5002`.

- `GET /health` — readiness check
- `GET /speakers` — list of VCTK speaker IDs
- `POST /synthesize` — JSON `{ "text": "...", "speaker_idx": "p228" }` → `audio/wav`

### Health check

```bash
curl http://127.0.0.1:5002/health
# → {"status":"ok","model":"tts_models/en/vctk/vits","device":"cpu"}
```

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `COQUI_TTS_URL` | `http://127.0.0.1:5002` | Base URL of the sidecar (read by the Next.js provider). |
| `COQUI_TTS_FEMININE_SPEAKER` | `p228` | VCTK speaker ID used for the feminine voice. |
| `COQUI_TTS_MASCULINE_SPEAKER` | `p226` | VCTK speaker ID used for the masculine voice. |
| `COQUI_DEFAULT_SPEAKER` | `p228` | Sidecar fallback when `speaker_idx` is omitted in the request. |

All have sensible defaults — no configuration needed for local use. Set them in `.env.local` to override. To browse all available speaker IDs: `curl http://127.0.0.1:5002/speakers`

---

## Architecture

The `/api/tts` route uses a **provider router** (`lib/tts/router.ts`) to select the best available TTS engine per language. For English the primary provider is this sidecar. Cloud providers remain as automatic fallbacks if the sidecar is offline.

```
ReadAloudPanel
    │
    │  POST /api/tts  { text, targetLang: "en", gender }
    ▼
lib/tts/router.ts  (getTtsProvider)
    │
    ├── "en" or "auto"  → coqui-local  ──────────► services/coqui-tts/server.py
    │                                                   FastAPI + VITS/VCTK model
    │                                                   splits text → sentences
    │                                                   returns audio/wav
    │
    ├── (fallback if sidecar offline) → deepgram
    │
    └── (fallback) → xtts (Replicate)
```

Languages other than English continue to use their existing providers (Deepgram for es/fr/de/it/ja/nl, MiniMax for sv/vi, XTTS for everything else).

### How synthesis works

1. The Next.js `coqui-local` provider POSTs `{ text, speaker_idx }` to `/synthesize`.
2. `split_sentences()` breaks the text into ≤200-character chunks, stripping bullet characters and normalising whitespace. This avoids a PyTorch tensor dimension error that occurs when the VITS model receives very long inputs.
3. Each sentence is synthesised individually via `TTS.tts()`, producing a NumPy float32 array.
4. All chunks are concatenated and encoded into a single in-memory WAV file.
5. The WAV binary is returned with `Content-Type: audio/wav`.
6. The Next.js provider returns an `ArrayBuffer`; the translate page creates an object URL for the `<audio>` element and the existing `TtsPlaybackVisual` UI renders (waveform, Pause, -5s, Download, speed).

---

## Model details

| Property | Value |
|----------|-------|
| Model | `tts_models/en/vctk/vits` |
| Architecture | VITS (end-to-end, no separate vocoder) |
| Language | English |
| Speakers | 109 VCTK speakers (p225–p376) |
| Runtime | CPU only (no GPU required) |
| Inference speed | ~4–8× real time on a modern CPU |
| First-run download | ~140 MB (cached in `~/.local/share/tts/`) |

---

## Fallback behaviour

| Scenario | Result |
|----------|--------|
| Sidecar running, synthesis succeeds | Audio served from local model. `X-TTS-Provider: coqui-local` |
| Sidecar offline (connection refused) | Falls back to Deepgram (if `DEEPGRAM_API_KEY` set) |
| Sidecar offline, Deepgram not configured | Falls back to XTTS on Replicate (if `REPLICATE_API_TOKEN` set) |
| All providers fail | `503 All TTS providers failed` shown in UI |

---

## Files changed in the Next.js app

### New files

| File | Purpose |
|------|---------|
| `services/coqui-tts/server.py` | This sidecar. |
| `lib/tts/providers/coqui-local.ts` | Next.js provider that calls the sidecar, maps `Gender` to a VCTK speaker ID, and falls back cleanly on connection errors. |

### Modified files

| File | What changed |
|------|-------------|
| `lib/tts/types.ts` | Added `'coqui-local'` to the `TtsProvider` union. |
| `lib/tts/router.ts` | Routes `'en'` and `'auto'` to `coqui-local`. Fixed a bug where "Detect language" uploads (`sourceLang = 'auto'`) were routed to XTTS instead of English providers. Fallback chain: `['coqui-local', 'deepgram', 'xtts']`. |
| `lib/tts/deepgram-voices.test.ts` | Updated `getTtsProvider` tests for new routing. |
| `components/features/tts/ReadAloudPanel.tsx` | Committed for the first time (was on disk but untracked). Encapsulates all Read Aloud UI state. |
| `app/translate/[id]/page.tsx` | Replaced inline TTS state/dialog with `<ReadAloudPanel>`. |
| `.env.local.example` | Added the three Coqui env vars above. |

---

## Known limitations / future work

- **Word-level sync is approximate.** `TtsPlaybackVisual` uses character-position estimation, not true forced alignment. A future improvement would return per-word timestamps from the sidecar.
- **Spanish and Vietnamese** are not yet on a local model. A follow-up PR will add those languages to this sidecar.
- **GPU support.** Change `.to("cpu")` to `.to("cuda")` in `server.py` for faster synthesis if a GPU is available.
- **Single process.** Concurrent requests queue. For production, run multiple uvicorn workers.
