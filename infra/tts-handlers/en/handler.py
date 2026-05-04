"""
HF Inference Endpoint handler for Resilient-Coders/coqui-vctk-en

This file makes the English VCTK model deployable as a native HuggingFace
Inference Endpoint — no Space layer required.

Deploy steps:
  1. git clone https://huggingface.co/Resilient-Coders/coqui-vctk-en
  2. cp infra/tts-handlers/en/handler.py coqui-vctk-en/
  3. cp infra/tts-handlers/en/requirements.txt coqui-vctk-en/
  4. cd coqui-vctk-en && git add . && git commit -m "feat: add HF Inference Endpoint handler" && git push
  5. Go to https://huggingface.co/inference-endpoints and create an endpoint
     pointing at Resilient-Coders/coqui-vctk-en.
  6. Copy the endpoint URL into HF_TTS_ENDPOINT_EN in your .env.local.

Request format (standard HF Inference API):
  POST /
  Authorization: Bearer <HF_TOKEN>
  Content-Type: application/json
  { "inputs": "Text to speak.", "parameters": { "speaker_id": "p228" } }

Response: audio/wav bytes

Speaker IDs: VCTK corpus multi-speaker model.
  Feminine default : p228
  Masculine default: p226
  Full list: http://www.udialogue.org/download/VCTK-Corpus.html
"""

import io
import json
import os
import re

import numpy as np
import soundfile as sf
from TTS.api import TTS

DEFAULT_SPEAKER = os.environ.get("COQUI_DEFAULT_SPEAKER", "p228")
WEIGHT_FILE_CANDIDATES = ("model.pth", "model_file.pth.tar", "model_file.pth")


def _split_sentences(text: str) -> list[str]:
    """Split text into <=200-char sentence chunks for Coqui TTS."""
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


def _resolve_weight(path: str) -> str:
    for name in WEIGHT_FILE_CANDIDATES:
        candidate = os.path.join(path, name)
        if os.path.isfile(candidate):
            return candidate
    raise RuntimeError(f"No weight file found in {path!r}")


class EndpointHandler:
    def __init__(self, path: str = ""):
        weight_path = _resolve_weight(path)
        config_path = os.path.join(path, "config.json")

        print(f"[handler/en] loading {weight_path}", flush=True)
        self.tts = TTS(
            model_path=weight_path,
            config_path=config_path,
            progress_bar=False,
        ).to("cpu")

        with open(config_path) as f:
            cfg = json.load(f)
        self.sample_rate: int = cfg.get("audio", {}).get("sample_rate", 22050)
        print(f"[handler/en] ready — sample_rate={self.sample_rate}", flush=True)

    def __call__(self, data: dict) -> bytes:
        text: str = data.get("inputs", "")
        params: dict = data.get("parameters") or {}
        speaker: str = params.get("speaker_id", DEFAULT_SPEAKER)

        if not text or not text.strip():
            raise ValueError("inputs must be a non-empty string")

        sentences = _split_sentences(text)
        if not sentences:
            raise ValueError("No speakable text after preprocessing")

        audio_parts: list[np.ndarray] = []
        for sentence in sentences:
            try:
                wav = self.tts.tts(text=sentence, speaker=speaker)
                audio_parts.append(np.array(wav, dtype=np.float32))
            except Exception as exc:
                print(f"[handler/en] skipping sentence: {exc!r}", flush=True)

        if not audio_parts:
            raise RuntimeError("All sentences failed to synthesize")

        combined = np.concatenate(audio_parts)
        buf = io.BytesIO()
        sf.write(buf, combined, samplerate=self.sample_rate, format="WAV")
        return buf.getvalue()
