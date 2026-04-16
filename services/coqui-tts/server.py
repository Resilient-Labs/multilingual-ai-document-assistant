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
from pydantic import BaseModel, Field, field_validator
from TTS.api import TTS

HOST = "127.0.0.1"
PORT = 5002
DEFAULT_SPEAKER = os.environ.get("COQUI_DEFAULT_SPEAKER", "p228")

MODELS: dict[str, str] = {
    "en": os.environ.get("COQUI_TTS_EN_MODEL", "tts_models/en/vctk/vits"),
    "es": os.environ.get("COQUI_TTS_ES_MODEL", "tts_models/es/css10/vits"),
    "vi": os.environ.get("COQUI_TTS_VI_MODEL", "tts_models/vie/fairseq/vits"),
}

app = FastAPI(title="Local Coqui TTS", version="1.0.0")
tts_instances: dict[str, TTS] = {}


class SynthesizeRequest(BaseModel):
    text: str = Field(min_length=1)
    speaker_idx: str | None = None
    language: str = "en"

    @field_validator("language")
    @classmethod
    def normalize_language(cls, v: str) -> str:
        key = (v or "en").strip().lower()
        if key not in MODELS:
            raise ValueError(f"Unsupported language: {v!r}. Use one of: {', '.join(sorted(MODELS))}.")
        return key


def get_tts(lang: str) -> TTS:
    if lang not in MODELS:
        raise HTTPException(status_code=400, detail=f"Unsupported language: {lang}")
    if lang not in tts_instances:
        model_name = MODELS[lang]
        print(f"[coqui-tts] loading model for {lang}: {model_name}")
        tts_instances[lang] = TTS(model_name=model_name, progress_bar=False).to("cpu")
    return tts_instances[lang]


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


@app.get("/health")
async def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "device": "cpu",
        "loaded_languages": sorted(tts_instances.keys()),
        "supported_languages": sorted(MODELS.keys()),
    }


@app.get("/speakers")
async def speakers() -> dict[str, list[str]]:
    model = get_tts("en")
    return {"speakers": get_speakers(model)}


def split_sentences(text: str) -> list[str]:
    """Split text into sentences suitable for VITS synthesis (~200 chars each)."""
    # Normalise whitespace and strip bullet/special lead chars
    text = re.sub(r"[\r\n]+", " ", text)
    text = re.sub(r"[\u2022\u00b7\u2023\u25aa\u25b8\u25ba]+", "", text)
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
    lang = payload.language
    model = get_tts(lang)
    sample_rate = resolve_sample_rate(model)
    sentences = split_sentences(payload.text)

    if not sentences:
        raise HTTPException(status_code=400, detail="No speakable text provided")

    import numpy as np

    audio_parts: list[Any] = []
    for sentence in sentences:
        try:
            if lang == "en":
                speaker = payload.speaker_idx or DEFAULT_SPEAKER
                wav = model.tts(text=sentence, speaker=speaker)
            else:
                wav = model.tts(text=sentence)
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
