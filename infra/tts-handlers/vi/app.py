"""
FastAPI server for the Resilient-Coders/mms-tts-vie HF Inference Endpoint.

Listens on port 80. Vietnamese MMS/fairseq VITS model.
Uses Coqui's fairseq loader via model_name + TTS_HOME mirror (same approach as the Space).

  POST /
    { "inputs": "Văn bản cần đọc." }
    → audio/wav bytes

  GET /health
    → { "status": "ok" }
"""

import asyncio
import io
import os
import re
import shutil
import threading
from contextlib import asynccontextmanager

import numpy as np
import soundfile as sf
import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from huggingface_hub import snapshot_download
from TTS.api import TTS

PORT = int(os.environ.get("PORT", 80))
REPO_ID = os.environ.get("HF_MODEL_REPO", "Resilient-Coders/mms-tts-vie")

TTS_HOME = os.path.join(os.path.expanduser("~"), ".local", "share", "tts")
VI_MODEL_NAME = "tts_models/vie/fairseq/vits"
VI_TTS_HOME_DIR = os.path.join(TTS_HOME, "tts_models--vie--fairseq--vits")

_tts_model: TTS | None = None
_tts_lock = threading.Lock()


def _split_sentences(text: str) -> list[str]:
    text = re.sub(r"[\r\n]+", " ", text)
    text = re.sub(r"[\u2022\u00b7\u2023\u25aa\u25b8\u25ba]+", "", text)
    text = re.sub(r"\s{2,}", " ", text).strip()
    raw = re.split(r"(?<=[.!?])\s+", text)
    sentences: list[str] = []
    current = ""
    for chunk in raw:
        chunk = chunk.strip()
        if not chunk:
            continue
        if len(current) + len(chunk) > 200 and current:
            sentences.append(current.strip())
            current = chunk
        else:
            current = (current + " " + chunk).strip()
    if current:
        sentences.append(current.strip())
    return [s for s in sentences if s]


def _setup_fairseq_mirror(local_dir: str) -> None:
    """Mirror HF snapshot files into TTS_HOME so Coqui's fairseq loader finds them."""
    os.makedirs(VI_TTS_HOME_DIR, exist_ok=True)
    for fname in os.listdir(local_dir):
        if fname.startswith("."):
            continue
        src = os.path.realpath(os.path.join(local_dir, fname))
        dst = os.path.join(VI_TTS_HOME_DIR, fname)
        if not os.path.exists(dst) and os.path.isfile(src):
            try:
                os.symlink(src, dst)
            except OSError:
                shutil.copy2(src, dst)
            print(f"[server/vi] mirrored {fname}", flush=True)


def _load_model() -> TTS:
    print(f"[server/vi] downloading {REPO_ID}", flush=True)
    local_dir = snapshot_download(repo_id=REPO_ID)
    _setup_fairseq_mirror(local_dir)
    print(f"[server/vi] loading via model_name={VI_MODEL_NAME}", flush=True)
    model = TTS(model_name=VI_MODEL_NAME, progress_bar=False).to("cpu")
    print("[server/vi] model ready", flush=True)
    return model


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _tts_model
    loop = asyncio.get_event_loop()
    _tts_model = await loop.run_in_executor(None, _load_model)
    yield


app = FastAPI(title="mms-tts-vie inference", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/health")
async def health():
    return {"status": "ok", "ready": _tts_model is not None}


@app.post("/")
async def infer(request: Request):
    if _tts_model is None:
        raise HTTPException(status_code=503, detail="Model not loaded yet")

    data = await request.json()
    text: str = data.get("inputs", "")

    if not text or not text.strip():
        raise HTTPException(status_code=400, detail="inputs must be a non-empty string")

    sentences = _split_sentences(text)
    if not sentences:
        raise HTTPException(status_code=400, detail="No speakable text after preprocessing")

    loop = asyncio.get_event_loop()

    def _synth():
        parts = []
        with _tts_lock:
            for sentence in sentences:
                try:
                    wav = _tts_model.tts(text=sentence)
                    parts.append(np.array(wav, dtype=np.float32))
                except Exception as exc:
                    print(f"[server/vi] skipping sentence: {exc!r}", flush=True)
        return parts

    audio_parts = await loop.run_in_executor(None, _synth)

    if not audio_parts:
        raise HTTPException(status_code=500, detail="All sentences failed to synthesize")

    combined = np.concatenate(audio_parts)
    sample_rate = 16000  # MMS-TTS outputs 16 kHz

    buf = io.BytesIO()
    sf.write(buf, combined, samplerate=sample_rate, format="WAV")
    return Response(content=buf.getvalue(), media_type="audio/wav")


if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=PORT, reload=False)
