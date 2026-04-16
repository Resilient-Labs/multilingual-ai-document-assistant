import io
import os
import re
from typing import Any

# Monkey-patch missing `isin_mps_friendly` removed from newer transformers
# before coqui-tts imports it via its tortoise/XTTS layers.
import importlib
import torch

_pt_utils = importlib.import_module("transformers.pytorch_utils")
if not hasattr(_pt_utils, "isin_mps_friendly"):
    def _isin_mps_friendly(elements: torch.Tensor, test_elements: torch.Tensor) -> torch.Tensor:
        if test_elements.device.type == "mps":
            test_elements = test_elements.cpu()
        return torch.isin(elements, test_elements)
    _pt_utils.isin_mps_friendly = _isin_mps_friendly

import soundfile as sf
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field
from TTS.api import TTS

MODEL_NAME = "tts_models/en/vctk/vits"
HOST = "127.0.0.1"
PORT = 5002
DEFAULT_SPEAKER = os.environ.get("COQUI_DEFAULT_SPEAKER", "p228")

app = FastAPI(title="Local Coqui TTS", version="1.0.0")
tts: TTS | None = None


class SynthesizeRequest(BaseModel):
    text: str = Field(min_length=1)
    speaker_idx: str | None = None


def get_speakers(model: TTS) -> list[str]:
    manager = getattr(getattr(model, "synthesizer", None), "tts_model", None)
    speaker_manager = getattr(manager, "speaker_manager", None)

    if speaker_manager is None:
        return []

    speaker_names: Any = getattr(speaker_manager, "speaker_names", None)
    if isinstance(speaker_names, list):
        return [str(name) for name in speaker_names]

    name_to_id: Any = getattr(speaker_manager, "name_to_id", None)
    if isinstance(name_to_id, dict):
        return [str(name) for name in name_to_id.keys()]

    speakers: Any = getattr(speaker_manager, "speakers", None)
    if isinstance(speakers, dict):
        return [str(name) for name in speakers.keys()]

    return []


def resolve_sample_rate(model: TTS) -> int:
    synthesizer = getattr(model, "synthesizer", None)
    rate = getattr(synthesizer, "output_sample_rate", None) if synthesizer else None
    if isinstance(rate, int) and rate > 0:
        return rate
    return 22050


@app.on_event("startup")
async def load_model() -> None:
    global tts
    tts = TTS(model_name=MODEL_NAME, progress_bar=False).to("cpu")


@app.get("/health")
async def health() -> dict[str, str]:
    return {
        "status": "ok" if tts is not None else "loading",
        "model": MODEL_NAME,
        "device": "cpu",
    }


@app.get("/speakers")
async def speakers() -> dict[str, list[str]]:
    if tts is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    return {"speakers": get_speakers(tts)}


def split_sentences(text: str) -> list[str]:
    """Split text into sentences suitable for VITS synthesis (~200 chars each)."""
    # Normalise whitespace and strip bullet/special lead chars
    text = re.sub(r"[\r\n]+", " ", text)
    text = re.sub(r"[•·‣▪▸►]+", "", text)
    text = re.sub(r"\s{2,}", " ", text).strip()

    # Split on sentence-ending punctuation
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


@app.post("/synthesize")
async def synthesize(payload: SynthesizeRequest) -> Response:
    if tts is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    speaker = payload.speaker_idx or DEFAULT_SPEAKER
    sample_rate = resolve_sample_rate(tts)
    sentences = split_sentences(payload.text)

    if not sentences:
        raise HTTPException(status_code=400, detail="No speakable text provided")

    import numpy as np

    audio_parts: list[Any] = []
    for sentence in sentences:
        try:
            wav = tts.tts(text=sentence, speaker=speaker)
            audio_parts.append(np.array(wav, dtype=np.float32))
        except Exception as error:
            # Skip individual sentences that fail rather than aborting everything
            print(f"[coqui-tts] skipping sentence due to error: {error!r}")
            continue

    if not audio_parts:
        raise HTTPException(status_code=500, detail="All sentences failed to synthesize")

    combined = np.concatenate(audio_parts)
    buffer = io.BytesIO()
    sf.write(buffer, combined, samplerate=sample_rate, format="WAV")
    return Response(content=buffer.getvalue(), media_type="audio/wav")


if __name__ == "__main__":
    uvicorn.run("server:app", host=HOST, port=PORT, reload=False)
