"""Text-to-speech. Three providers behind one function, chosen by `settings.tts_provider`:

- `piper`: a voice that runs on the server itself (Piper, en_US-lessac-medium, MIT license): no key, no quota, no waiting
  line, about a second for a sentence. The safety net when the two others are over their limit or slow.

- `deepinfra`: Kokoro-82M (Apache license), ~0.99 $ per million characters, one request per reply.
- `groq`: Orpheus (Preview model), ~22 $ per million characters, under 200 characters per request: the reply is
  split into sentences, one request each (`Speech.parts`), so the first part can play while the others are made.

Neither answer format could be confirmed without a key: the DeepInfra audio field is decoded defensively
(data URI, raw base64 or URL) and must be checked once with scripts/voice_bench.py.
"""
import base64
import io
import os
import re
import struct
import threading
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
PRICE_PER_MILLION_CHARS = {"deepinfra": 0.99, "groq": 22.0, "piper": 0.0}  # USD, from the providers' pages (October 2026)
MP3_MIME = "audio/mpeg"


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
    _playable: tuple[bytes, str] | None = field(default=None, init=False, repr=False, compare=False)

    @property
    def audio(self) -> bytes:
        """The whole reply as one file (several WAV parts are joined)."""
        return merge_wav(self.parts) if self.mime == "audio/wav" else self.parts[0]  # also repairs a streaming header

    @property
    def playable(self) -> tuple[bytes, str]:
        """(bytes, mime) of what the front receives. Groq only speaks WAV (about 48 KB per second of voice), which is
        400 KB for one reply: two seconds of download on a 3G phone. The reply is sent as a 64 kbps MP3 instead (about 8 KB
        per second), which every browser plays. If the encoding cannot be done, the WAV goes out unchanged: the voice
        never fails because of the compression."""
        if self._playable is None:
            wav_audio = self.mime == "audio/wav"
            if wav_audio and settings.tts_compress:
                try:
                    self._playable = (encode_mp3(self.audio, settings.tts_mp3_kbps), MP3_MIME)
                except (TtsError, ImportError, ValueError, RuntimeError):
                    self._playable = (self.audio, self.mime)
            else:
                self._playable = (self.audio, self.mime)
        return self._playable

    @property
    def data_uri(self) -> str:
        """The audio as a `data:` URL the front can put in `<audio src>`: nothing is stored on the server."""
        data, mime = self.playable
        return f"data:{mime};base64,{base64.b64encode(data).decode()}"

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


def encode_mp3(wav: bytes, kbps: int = 64) -> bytes:
    """A mono or stereo 16-bit PCM WAV as an MP3 (LAME, constant bit rate)."""
    import lameenc  # imported here: a missing wheel only turns the compression off, it does not stop the API

    (channels, width, rate), pcm = _wav_pcm(wav)
    if width != 2 or channels not in (1, 2):
        raise TtsError("only 16-bit mono or stereo WAV can be compressed")
    encoder = lameenc.Encoder()
    encoder.set_bit_rate(kbps)
    encoder.set_in_sample_rate(rate)
    encoder.set_channels(channels)
    encoder.set_quality(5)  # LAME default: 4 times faster than 2 (about 4 ms per second of voice) for the same size and no audible difference on speech
    return bytes(encoder.encode(pcm)) + bytes(encoder.flush())


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


def _budget(factor: float = 1.0) -> httpx.Timeout:
    """How long one reply's voice may take before another voice takes over (a text answer is already on the screen).
    `factor` is per provider (BUDGET_FACTOR): DeepInfra is the slower one (measured on 23 October: Groq 1 to 2 s when idle,
    DeepInfra 3 to 5 s on 23 October, then 3 to 16 s depending on the minute on 25 October) and the one before Piper, the voice that
    runs on the server: it gets 1.4 times the time, then Piper answers."""
    return httpx.Timeout(settings.tts_timeout * factor, connect=settings.voice_connect_timeout)


def _deepinfra(client: httpx.Client, text: str, voice: str | None, factor: float = 1.0):
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
        timeout=_budget(factor),
    )
    r.raise_for_status()
    data = r.json()
    audio = _decode_audio(data.get("audio"), client)
    fmt = str(data.get("output_format") or "wav").lower()
    mime = {"mp3": "audio/mpeg", "wav": "audio/wav", "opus": "audio/ogg", "flac": "audio/flac"}.get(fmt, "audio/wav")
    return [audio], mime, [time.perf_counter() - t0]


def _groq_one(client: httpx.Client, chunk: str, voice: str, factor: float = 1.0) -> tuple[bytes, float]:
    t0 = time.perf_counter()
    r = client.post(
        "https://api.groq.com/openai/v1/audio/speech",
        headers={"Authorization": f"Bearer {settings.groq_api_key}"},
        json={"model": "canopylabs/orpheus-v1-english", "input": chunk, "voice": voice, "response_format": "wav"},
        timeout=_budget(factor),
    )
    r.raise_for_status()
    return r.content, time.perf_counter() - t0


def _groq(client: httpx.Client, text: str, voice: str | None, factor: float = 1.0):
    if not settings.groq_api_key:
        raise TtsError("GROQ_API_KEY is not set")
    chunks = split_text(text)
    with ThreadPoolExecutor(max_workers=min(4, max(1, len(chunks)))) as pool:  # parts are made in parallel
        results = list(pool.map(lambda c: _groq_one(client, c, voice or GROQ_VOICE, factor), chunks))
    return [audio for audio, _ in results], "audio/wav", [lat for _, lat in results]


_piper_voice = None
_piper_lock = threading.Lock()  # the model is loaded once, and the phonemizer is not shared by two threads at the same time


def _piper(client: httpx.Client, text: str, voice: str | None, factor: float = 1.0):
    """The voice that runs here. Nothing to rest: "is not set" in a message means a configuration choice, not an outage."""
    global _piper_voice
    path = settings.piper_model_path
    if not path or not os.path.isfile(path):
        raise TtsError("the Piper voice is not set up (PIPER_MODEL_PATH is not set or the file is missing)")
    t0 = time.perf_counter()
    try:
        with _piper_lock:
            if _piper_voice is None:
                from piper import PiperVoice  # imported here: a missing wheel only turns this provider off

                _piper_voice = PiperVoice.load(path)
            out = io.BytesIO()
            with wave.open(out, "wb") as w:
                _piper_voice.synthesize_wav(text, w)
    except ImportError as e:
        raise TtsError("the Piper voice is not set up (piper-tts is not installed)") from e
    except Exception as e:  # a model that cannot be read or a text it cannot say: the next provider takes over
        _piper_voice = None
        raise TtsError(f"piper failed: {type(e).__name__}") from e
    return [out.getvalue()], "audio/wav", [time.perf_counter() - t0]


PROVIDERS = {"deepinfra": _deepinfra, "groq": _groq, "piper": _piper}
BUDGET_FACTOR = {"groq": 1.0, "deepinfra": 1.4, "piper": 1.0}  # DeepInfra is no longer the last resort (Piper is): it does not get 15 s  # times settings.tts_timeout


_shared: httpx.Client | None = None
_shared_lock = threading.Lock()


def _shared_client() -> httpx.Client:
    """One client for the whole process: the connection to the provider stays open between two replies, so a reply does
    not pay a new TLS handshake (a few hundred milliseconds before the voice can even start). httpx clients are thread-safe."""
    global _shared
    with _shared_lock:  # two voice turns arriving together at the first use must not each build a client
        if _shared is None:
            _shared = httpx.Client(
                timeout=httpx.Timeout(settings.voice_timeout, connect=settings.voice_connect_timeout),
                limits=httpx.Limits(max_keepalive_connections=8, keepalive_expiry=60),
            )
        return _shared


def _synthesize_one(name: str, text: str, voice: str | None, client: httpx.Client | None) -> Speech:
    if name not in PROVIDERS:
        raise TtsError(f"unknown TTS provider {name!r}: expected one of {list(PROVIDERS)}")
    http = client or _shared_client()
    t0 = time.perf_counter()
    try:
        parts, mime, latencies = PROVIDERS[name](http, text, voice, BUDGET_FACTOR.get(name, 1.0))
    except TtsError:
        raise
    except httpx.HTTPStatusError as e:
        raise TtsError(f"{name} answered {e.response.status_code}{provider_message(e.response)}", e.response.status_code) from e
    except (httpx.HTTPError, ValueError) as e:
        error = TtsError(f"{name} failed: {type(e).__name__}")
        error.transient = isinstance(e, (httpx.ConnectError, httpx.ConnectTimeout, httpx.RemoteProtocolError))  # never reached the provider, or a kept-alive connection the provider had closed: safe to retry
        raise error from e
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
