"""Text-to-speech. Two providers behind one function, chosen by `settings.tts_provider`:

- `deepinfra`: Kokoro-82M (Apache license), ~0.99 $ per million characters, one request per reply.
- `groq`: Orpheus (Preview model), ~22 $ per million characters, under 200 characters per request: the reply is
  split into sentences, one request each (`Speech.parts`), so the first part can play while the others are made.

Neither answer format could be confirmed without a key: the DeepInfra audio field is decoded defensively
(data URI, raw base64 or URL) and must be checked once with scripts/voice_bench.py.
"""
import base64
import io
import re
import struct
import time
import wave
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field

import httpx

from app.config import settings
from app.voice import failover
from app.voice.errors import provider_message

GROQ_MAX_CHARS = 190  # the documented limit is 200
GROQ_VOICE = "hannah"  # autumn, diana, hannah, austin, daniel, troy
PRICE_PER_MILLION_CHARS = {"deepinfra": 0.99, "groq": 22.0}  # USD, from the providers' pages (October 2026)


class TtsError(RuntimeError):
    """The speech synthesis failed. `status` is the provider's HTTP status when there was one."""

    def __init__(self, message: str, status: int | None = None):
        super().__init__(message)
        self.status = status
        self.transient = False  # the connection itself failed: one immediate retry is worth it


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
    def audio(self) -> bytes:
        """The whole reply as one file (several WAV parts are joined)."""
        return merge_wav(self.parts) if self.mime == "audio/wav" else self.parts[0]  # also repairs a streaming header

    @property
    def data_uri(self) -> str:
        """The audio as a `data:` URL the front can put in `<audio src>`: nothing is stored on the server."""
        return f"data:{self.mime};base64,{base64.b64encode(self.audio).decode()}"

    @property
    def cost_usd(self) -> float:
        return self.chars * PRICE_PER_MILLION_CHARS[self.provider] / 1_000_000


def _wav_pcm(data: bytes) -> tuple[tuple[int, int, int], bytes]:
    """((channels, sample width in bytes, rate), raw samples) of a WAV file, tolerating the "streaming" header some
    providers send (RIFF and data sizes set to 0xFFFFFFFF, extra chunks before the samples)."""
    if data[:4] != b"RIFF" or data[8:12] != b"WAVE":
        raise TtsError("unreadable WAV part: not a RIFF/WAVE file")
    fmt, pos = None, 12
    while pos + 8 <= len(data):
        chunk_id, size = data[pos:pos + 4], struct.unpack("<I", data[pos + 4:pos + 8])[0]
        body = pos + 8
        if chunk_id == b"fmt ":
            tag, channels, rate, _, _, bits = struct.unpack("<HHIIHH", data[body:body + 16])
            if tag != 1 or bits % 8:
                raise TtsError("unreadable WAV part: only PCM is supported")
            fmt = (channels, bits // 8, rate)
        elif chunk_id == b"data":
            if fmt is None:
                raise TtsError("unreadable WAV part: data before fmt")
            end = body + size if body + size <= len(data) else len(data)  # a size past the end means "until the end"
            return fmt, data[body:end]
        pos = body + size + (size & 1)
    raise TtsError("unreadable WAV part: no data chunk")


def merge_wav(parts: list[bytes]) -> bytes:
    """One clean WAV file from one or several providers' files of the same format (header sizes rewritten)."""
    fmt, frames = None, []
    for part in parts:
        part_fmt, pcm = _wav_pcm(part)
        if fmt is not None and part_fmt != fmt:
            raise TtsError("audio parts have different formats")
        fmt = part_fmt
        frames.append(pcm)
    out = io.BytesIO()
    with wave.open(out, "wb") as w:
        w.setnchannels(fmt[0]), w.setsampwidth(fmt[1]), w.setframerate(fmt[2])
        for f in frames:
            w.writeframes(f)
    return out.getvalue()


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


def _synthesize_one(name: str, text: str, voice: str | None, client: httpx.Client | None) -> Speech:
    if name not in PROVIDERS:
        raise TtsError(f"unknown TTS provider {name!r}: expected one of {list(PROVIDERS)}")
    own = client is None
    http = client or httpx.Client(timeout=httpx.Timeout(settings.voice_timeout, connect=settings.voice_connect_timeout))
    t0 = time.perf_counter()
    try:
        parts, mime, latencies = PROVIDERS[name](http, text, voice)
    except TtsError:
        raise
    except httpx.HTTPStatusError as e:
        raise TtsError(f"{name} answered {e.response.status_code}{provider_message(e.response)}", e.response.status_code) from e
    except (httpx.HTTPError, ValueError) as e:
        error = TtsError(f"{name} failed: {type(e).__name__}")
        error.transient = isinstance(e, (httpx.ConnectError, httpx.ConnectTimeout))  # never reached the provider: safe to retry
        raise error from e
    finally:
        if own:
            http.close()
    return Speech(parts, mime, name, len(text), time.perf_counter() - t0, min(latencies), latencies)


def synthesize(
    text: str, *, provider: str | None = None, voice: str | None = None, client: httpx.Client | None = None
) -> Speech:
    """Coach reply in, audio out. With `provider`, only that one is tried. Otherwise `settings.tts_provider` is a chain
    ("groq,deepinfra"): the next provider takes over when one fails, and a failing one rests for a few minutes.
    Raises TtsError when every provider failed: the route still returns the text (the app then speaks it with the
    browser's own voice)."""
    text = " ".join(text.split())
    if not text:
        raise TtsError("empty text")
    chain = [provider] if provider else failover.ordered("tts", failover.names(settings.tts_provider))
    errors: list[str] = []
    for name in chain:
        try:
            try:
                speech = _synthesize_one(name, text, voice, client)
            except TtsError as first:
                if not first.transient:
                    raise
                speech = _synthesize_one(name, text, voice, client)
        except TtsError as e:
            errors.append(str(e))
            if "is not set" not in str(e):  # a missing key is a configuration choice, not an outage
                failover.mark_down("tts", name, e.status)
            continue
        failover.mark_ok("tts", name)
        return speech
    raise TtsError("; ".join(errors) or "no TTS provider configured")
