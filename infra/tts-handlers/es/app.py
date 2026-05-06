"""
FastAPI server for the Resilient-Coders/coqui-css10-es HF Inference Endpoint.

Listens on port 80. Single-speaker Spanish CSS10 model — no speaker selection.

  POST /
    { "inputs": "Texto para hablar." }
    → audio/wav bytes

  GET /health
    → { "status": "ok" }
"""

import asyncio
import io
import json
import os
import re
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
REPO_ID = os.environ.get("HF_MODEL_REPO", "Resilient-Coders/coqui-css10-es")

WEIGHT_FILE_CANDIDATES = ["model.pth", "model_file.pth.tar", "model_file.pth"]
PATH_KEYS = ("speakers_file", "speaker_ids_file", "d_vector_file")

_tts_model: TTS | None = None
_tts_lock = threading.Lock()


def _resolve_weights(local_dir: str) -> str:
    for name in WEIGHT_FILE_CANDIDATES:
        p = os.path.join(local_dir, name)
        if os.path.isfile(p):
            return p
    raise RuntimeError(f"No weight file found in {local_dir}")


def _patch_dict(obj: dict, local_dir: str) -> bool:
    changed = False
    for key, val in obj.items():
        if isinstance(val, dict):
            if _patch_dict(val, local_dir):
                changed = True
        elif key in PATH_KEYS and isinstance(val, str) and val and not os.path.isfile(val):
            candidate = os.path.join(local_dir, os.path.basename(val))
            if os.path.isfile(candidate):
                obj[key] = candidate
                changed = True
    return changed


def _patch_config(local_dir: str) -> str:
    config_path = os.path.join(local_dir, "config.json")
    real_path = os.path.realpath(config_path)
    with open(real_path) as f:
        cfg = json.load(f)
    if _patch_dict(cfg, local_dir):
        try:
            os.chmod(real_path, 0o644)
        except OSError:
            pass
        with open(real_path, "w") as f:
            json.dump(cfg, f)
    return config_path


def _split_sentences(text: str) -> list[str]:
    text = re.sub(r"[\r\n]+", " ", text)
    text = re.sub(r"[\u2022\u00b7\u2023\u25aa\u25b8\u25ba]+", "", text)
    text = re.sub(r"\s{2,}", " ", text).strip()
    raw = re.split(r"(?<=[.!?¡¿])\s+", text)
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


def _load_model() -> TTS:
    print(f"[server/es] downloading {REPO_ID}", flush=True)
    local_dir = snapshot_download(repo_id=REPO_ID)
    weights = _resolve_weights(local_dir)
    config_path = _patch_config(local_dir)
    print(f"[server/es] loading {weights}", flush=True)
    model = TTS(model_path=weights, config_path=config_path, progress_bar=False).to("cpu")
    print("[server/es] model ready", flush=True)
    return model


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _tts_model
    loop = asyncio.get_event_loop()
    _tts_model = await loop.run_in_executor(None, _load_model)
    yield


app = FastAPI(title="coqui-css10-es inference", lifespan=lifespan)
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
                    print(f"[server/es] skipping sentence: {exc!r}", flush=True)
        return parts

    audio_parts = await loop.run_in_executor(None, _synth)

    if not audio_parts:
        raise HTTPException(status_code=500, detail="All sentences failed to synthesize")

    combined = np.concatenate(audio_parts)
    synthesizer = getattr(_tts_model, "synthesizer", None)
    sample_rate = getattr(synthesizer, "output_sample_rate", 22050) or 22050

    buf = io.BytesIO()
    sf.write(buf, combined, samplerate=sample_rate, format="WAV")
    return Response(content=buf.getvalue(), media_type="audio/wav")


if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=PORT, reload=False)
