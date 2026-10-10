"""Text-to-speech. Two providers behind one function, chosen by `settings.tts_provider`:

- `deepinfra`: Kokoro-82M (Apache licence), ~0.99 $ per million characters, one request per reply.
- `groq`: Orpheus (Preview model), ~22 $ per million characters, under 200 characters per request: the reply is
  split into sentences, one request each (`Speech.parts`), so the first part can play while the others are made.

Neither answer format could be confirmed without a key: the DeepInfra audio field is decoded defensively
(data URI, raw base64 or URL) and must be checked once with scripts/voice_bench.py.
"""
import base64
import re
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field

import httpx

from app.config import settings
from app.voice.errors import provider_message

GROQ_MAX_CHARS = 190  # the documented limit is 200
GROQ_VOICE = "hannah"  # autumn, diana, hannah, austin, daniel, troy
PRICE_PER_MILLION_CHARS = {"deepinfra": 0.99, "groq": 22.0}  # USD, from the providers' pages (October 2026)


class TtsError(RuntimeError):
    """The speech synthesis failed."""


@dataclass
class Speech:
    parts: list[bytes]  # playable files in order (one for DeepInfra, one per sentence group for Groq)
    mime: str
    provider: str
    chars: int
    latency_s: float  # until the whole reply is ready
    first_part_s: float  # until the first part is ready: when the voice can start
    part_latencies: list[float] = field(default_factory=list)

    @property
    def cost_usd(self) -> float:
        return self.chars * PRICE_PER_MILLION_CHARS[self.provider] / 1_000_000


def split_text(text: str, limit: int = GROQ_MAX_CHARS) -> list[str]:
    """Sentences grouped up to `limit` characters (a longer sentence is cut at spaces)."""
    sentences = [s for s in re.split(r"(?<=[.!?])\s+", " ".join(text.split())) if s]
    chunks: list[str] = []
    for s in sentences:
        while len(s) > limit:
            cut = s.rfind(" ", 0, limit)
            cut = cut if cut > 0 else limit
            chunks.append(s[:cut].strip())
            s = s[cut:].strip()
        if chunks and len(chunks[-1]) + 1 + len(s) <= limit:
            chunks[-1] = f"{chunks[-1]} {s}"
        elif s:
            chunks.append(s)
    return chunks


def _decode_audio(value, client: httpx.Client) -> bytes:
    if not value or not isinstance(value, str):
        raise TtsError("the provider returned no audio")
    if value.startswith(("http://", "https://")):
        r = client.get(value)
        r.raise_for_status()
        return r.content
    if value.startswith("data:"):
        value = value.split(",", 1)[1]
    try:
        return base64.b64decode(value, validate=False)
    except ValueError as e:
        raise TtsError("the audio field is not base64") from e


def _deepinfra(client: httpx.Client, text: str, voice: str | None):
    if not settings.deepinfra_api_key:
        raise TtsError("DEEPINFRA_API_KEY is not set")
    body: dict = {"text": text}
    if voice:
        body["preset_voice"] = [voice]  # undocumented on the model page: dropped by the API if unknown
    t0 = time.perf_counter()
    r = client.post(
        "https://api.deepinfra.com/v1/inference/hexgrad/Kokoro-82M",
        headers={"Authorization": f"bearer {settings.deepinfra_api_key}"},
        json=body,
    )
    r.raise_for_status()
    data = r.json()
    audio = _decode_audio(data.get("audio"), client)
    fmt = str(data.get("output_format") or "wav").lower()
    mime = {"mp3": "audio/mpeg", "wav": "audio/wav", "opus": "audio/ogg", "flac": "audio/flac"}.get(fmt, "audio/wav")
    return [audio], mime, [time.perf_counter() - t0]


def _groq_one(client: httpx.Client, chunk: str, voice: str) -> tuple[bytes, float]:
    t0 = time.perf_counter()
    r = client.post(
        "https://api.groq.com/openai/v1/audio/speech",
        headers={"Authorization": f"Bearer {settings.groq_api_key}"},
        json={"model": "canopylabs/orpheus-v1-english", "input": chunk, "voice": voice, "response_format": "wav"},
    )
    r.raise_for_status()
    return r.content, time.perf_counter() - t0


def _groq(client: httpx.Client, text: str, voice: str | None):
    if not settings.groq_api_key:
        raise TtsError("GROQ_API_KEY is not set")
    chunks = split_text(text)
    with ThreadPoolExecutor(max_workers=min(4, max(1, len(chunks)))) as pool:  # parts are made in parallel
        results = list(pool.map(lambda c: _groq_one(client, c, voice or GROQ_VOICE), chunks))
    return [audio for audio, _ in results], "audio/wav", [lat for _, lat in results]


PROVIDERS = {"deepinfra": _deepinfra, "groq": _groq}


def synthesize(
    text: str, *, provider: str | None = None, voice: str | None = None, client: httpx.Client | None = None
) -> Speech:
    """Coach reply in, audio out. Raises TtsError on any failure: the route can still return the text without audio."""
    name = provider or settings.tts_provider
    if name not in PROVIDERS:
        raise TtsError(f"unknown TTS provider {name!r}: expected one of {list(PROVIDERS)}")
    text = " ".join(text.split())
    if not text:
        raise TtsError("empty text")
    own = client is None
    http = client or httpx.Client(timeout=settings.voice_timeout)
    t0 = time.perf_counter()
    try:
        parts, mime, latencies = PROVIDERS[name](http, text, voice)
    except TtsError:
        raise
    except httpx.HTTPStatusError as e:
        raise TtsError(f"{name} answered {e.response.status_code}{provider_message(e.response)}") from e
    except (httpx.HTTPError, ValueError) as e:
        raise TtsError(f"{name} failed: {type(e).__name__}") from e
    finally:
        if own:
            http.close()
    return Speech(parts, mime, name, len(text), time.perf_counter() - t0, min(latencies), latencies)
