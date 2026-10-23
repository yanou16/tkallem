"""Speech-to-text. Two providers behind one function, chosen by `settings.stt_provider`:

- `groq`: Whisper large-v3-turbo, OpenAI-compatible endpoint, ~0.04 $/hour, 10 s minimum billed per request.
- `deepinfra`: the same model, ~0.012 $/hour (0.0002 $/minute), its own endpoint.

The audio is sent as received (webm from Chrome, mp4 from Safari: both accepted) and never written to disk.
"""
import threading
import time
from dataclasses import dataclass, field

import httpx

from app.config import settings
from app.voice import failover
from app.voice.errors import provider_message

# Optional prompt written with disfluencies, meant to make Whisper keep "um", "uh" (off by default: on clean synthetic
# voices Whisper kept them anyway and the prompt changed nothing; prompts can also be hallucinated on silence).
# Re-test on real recordings before turning it on.
KEEP_FILLERS_PROMPT = "Umm, let me think like, hmm... Okay, here's what I'm, like, thinking."
MIN_AVG_LOGPROB = -1.0  # Whisper's mean log-probability per segment: below this the words are mostly guesses
LONG_PAUSE_SECONDS = 0.7  # silence between two words that counts as a hesitation


class SttError(RuntimeError):
    """The transcription failed (provider down, bad key, unreadable audio). `status` is the provider's HTTP status."""

    def __init__(self, message: str, status: int | None = None):
        super().__init__(message)
        self.status = status
        self.transient = False  # the connection itself failed: one immediate retry is worth it

    @property
    def bad_audio(self) -> bool:
        """The provider could not read the file (400, 415, 422): the student's problem, not an outage."""
        return self.status in (400, 415, 422)


@dataclass
class Transcription:
    text: str
    provider: str
    latency_s: float
    duration_s: float | None = None  # audio length, when the provider reports it
    words: list[dict] = field(default_factory=list)  # [{"text", "start", "end"}], empty if not provided
    segments: list[dict] = field(default_factory=list)  # Whisper's own confidence per segment, empty if not provided

    @property
    def unclear(self) -> bool:
        """Whisper heard noise or speech it could not follow and wrote something anyway (it then often invents text in
        another language). Better to ask the student to repeat than to send that text to the coach."""
        words = [w for w in self.text.split() if any(c.isalpha() for c in w)]
        foreign = [w for w in words if any(c.isalpha() and not c.isascii() for c in w)]
        if len(foreign) >= 2 and len(foreign) / len(words) >= 0.4:
            # Most words written in another alphabet or with foreign letters: Whisper invented text. One or two accented
            # names ("I live in Béjaïa", "Sétif and Médéa") stay accepted.
            return True
        segs = [s for s in self.segments if "avg_logprob" in s]
        if not segs:
            return False
        if all(s.get("no_speech_prob", 0) > 0.6 for s in segs):
            return True
        return sum(s["avg_logprob"] for s in segs) / len(segs) < MIN_AVG_LOGPROB

    def long_pauses(self, min_gap: float = LONG_PAUSE_SECONDS) -> int:
        """Silences longer than `min_gap` between consecutive words: a hesitation signal Whisper cannot erase."""
        ws = [w for w in self.words if "start" in w and "end" in w]
        return sum(1 for a, b in zip(ws, ws[1:]) if b["start"] - a["end"] >= min_gap)


def _words(raw: list[dict] | None) -> list[dict]:
    out = []
    for w in raw or []:
        text = w.get("word", w.get("text"))
        if text is not None and "start" in w and "end" in w:
            out.append({"text": str(text).strip(), "start": float(w["start"]), "end": float(w["end"])})
    return out


def _groq(client: httpx.Client, audio: bytes, filename: str, content_type: str, language: str, keep_fillers: bool):
    if not settings.groq_api_key:
        raise SttError("GROQ_API_KEY is not set")
    data = {
        "model": settings.stt_model,
        "language": language,
        "response_format": "verbose_json",
        "timestamp_granularities[]": "word",
        "temperature": "0",
    }
    if keep_fillers:
        data["prompt"] = KEEP_FILLERS_PROMPT
    r = client.post(
        "https://api.groq.com/openai/v1/audio/transcriptions",
        headers={"Authorization": f"Bearer {settings.groq_api_key}"},
        data=data,
        files={"file": (filename, audio, content_type)},
    )
    r.raise_for_status()
    body = r.json()
    return body.get("text", ""), body.get("duration"), _words(body.get("words")), body.get("segments") or []


def _deepinfra(client: httpx.Client, audio: bytes, filename: str, content_type: str, language: str, keep_fillers: bool):
    if not settings.deepinfra_api_key:
        raise SttError("DEEPINFRA_API_KEY is not set")
    # The documented fields are the file (`audio`) and the model in the URL; language and prompt are best-effort.
    data = {"language": language}
    if keep_fillers:
        data["initial_prompt"] = KEEP_FILLERS_PROMPT
    r = client.post(
        "https://api.deepinfra.com/v1/inference/openai/whisper-large-v3-turbo",
        headers={"Authorization": f"bearer {settings.deepinfra_api_key}"},
        data=data,
        files={"audio": (filename, audio, content_type)},
    )
    r.raise_for_status()
    body = r.json()
    duration = body.get("duration")
    if duration is None and body.get("input_length_ms") is not None:
        duration = body["input_length_ms"] / 1000
    return body.get("text", ""), duration, _words(body.get("words")), body.get("segments") or []


PROVIDERS = {"groq": _groq, "deepinfra": _deepinfra}


_shared: httpx.Client | None = None
_shared_lock = threading.Lock()


def _shared_client() -> httpx.Client:
    """One client for the whole process: the connection to the provider stays open between two recordings (no new TLS
    handshake each time). httpx clients are thread-safe."""
    global _shared
    with _shared_lock:  # two voice turns arriving together at the first use must not each build a client
        if _shared is None:
            _shared = httpx.Client(
                timeout=httpx.Timeout(settings.voice_timeout, connect=settings.voice_connect_timeout),
                limits=httpx.Limits(max_keepalive_connections=8, keepalive_expiry=60),
            )
        return _shared


def _transcribe_one(name, audio, filename, content_type, language, keep_fillers, client) -> Transcription:
    if name not in PROVIDERS:
        raise SttError(f"unknown STT provider {name!r}: expected one of {list(PROVIDERS)}")
    http = client or _shared_client()
    t0 = time.perf_counter()
    try:
        text, duration, words, segments = PROVIDERS[name](http, audio, filename, content_type, language, keep_fillers)
    except SttError:
        raise
    except httpx.HTTPStatusError as e:
        raise SttError(f"{name} answered {e.response.status_code}{provider_message(e.response)}", e.response.status_code) from e
    except (httpx.HTTPError, ValueError) as e:  # network, timeout, invalid JSON
        error = SttError(f"{name} failed: {type(e).__name__}")
        error.transient = isinstance(e, (httpx.ConnectError, httpx.ConnectTimeout, httpx.RemoteProtocolError))  # never reached the provider, or a kept-alive connection the provider had closed: safe to retry
        raise error from e
    return Transcription(text.strip(), name, time.perf_counter() - t0, duration, words, segments)


def transcribe(
    audio: bytes,
    filename: str = "answer.webm",
    content_type: str = "audio/webm",
    *,
    provider: str | None = None,
    language: str = "en",
    keep_fillers: bool = False,
    client: httpx.Client | None = None,
) -> Transcription:
    """Audio bytes in, text out. With `provider`, only that one is tried; otherwise `settings.stt_provider` is a chain
    ("groq,deepinfra") and the next provider takes over when one fails. Raises SttError when all failed (the route
    answers 502 and nothing is saved); `bad_audio` only when every provider said the file is unreadable."""
    if not audio:
        raise SttError("empty audio")
    if len(audio) > settings.max_audio_bytes:
        raise SttError(f"audio too large ({len(audio)} bytes, max {settings.max_audio_bytes})")
    chain = [provider] if provider else failover.ordered("stt", failover.names(settings.stt_provider))
    errors: list[SttError] = []
    for name in chain:
        try:
            try:
                heard = _transcribe_one(name, audio, filename, content_type, language, keep_fillers, client)
            except SttError as first:
                if not first.transient:
                    raise
                heard = _transcribe_one(name, audio, filename, content_type, language, keep_fillers, client)
        except SttError as e:
            errors.append(e)
            if "is not set" not in str(e) and not e.bad_audio:
                failover.mark_down("stt", name, e.status)
            continue
        failover.mark_ok("stt", name)
        return heard
    if not errors:
        raise SttError("no STT provider configured")
    real = [e for e in errors if not e.bad_audio]
    raise real[-1] if real else errors[0]
