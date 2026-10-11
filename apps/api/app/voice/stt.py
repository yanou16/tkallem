"""Speech-to-text. Two providers behind one function, chosen by `settings.stt_provider`:

- `groq`: Whisper large-v3-turbo, OpenAI-compatible endpoint, ~0.04 $/hour, 10 s minimum billed per request.
- `deepinfra`: the same model, ~0.012 $/hour (0.0002 $/minute), its own endpoint.

The audio is sent as received (webm from Chrome, mp4 from Safari: both accepted) and never written to disk.
"""
import time
from dataclasses import dataclass, field

import httpx

from app.config import settings
from app.voice.errors import provider_message

# Optional prompt written with disfluencies, meant to make Whisper keep "um", "uh" (off by default: on clean synthetic
# voices Whisper kept them anyway and the prompt changed nothing; prompts can also be hallucinated on silence).
# Re-test on real recordings before turning it on.
KEEP_FILLERS_PROMPT = "Umm, let me think like, hmm... Okay, here's what I'm, like, thinking."
LONG_PAUSE_SECONDS = 0.7  # silence between two words that counts as a hesitation


class SttError(RuntimeError):
    """The transcription failed (provider down, bad key, unreadable audio). `status` is the provider's HTTP status."""

    def __init__(self, message: str, status: int | None = None):
        super().__init__(message)
        self.status = status

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
    return body.get("text", ""), body.get("duration"), _words(body.get("words"))


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
    return body.get("text", ""), duration, _words(body.get("words"))


PROVIDERS = {"groq": _groq, "deepinfra": _deepinfra}


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
    """Audio bytes in, text out. Raises SttError on any failure (the route answers 502 and nothing is saved)."""
    name = provider or settings.stt_provider
    if name not in PROVIDERS:
        raise SttError(f"unknown STT provider {name!r}: expected one of {list(PROVIDERS)}")
    if not audio:
        raise SttError("empty audio")
    if len(audio) > settings.max_audio_bytes:
        raise SttError(f"audio too large ({len(audio)} bytes, max {settings.max_audio_bytes})")
    own = client is None
    http = client or httpx.Client(timeout=settings.voice_timeout)
    t0 = time.perf_counter()
    try:
        text, duration, words = PROVIDERS[name](http, audio, filename, content_type, language, keep_fillers)
    except SttError:
        raise
    except httpx.HTTPStatusError as e:
        raise SttError(f"{name} answered {e.response.status_code}{provider_message(e.response)}", e.response.status_code) from e
    except (httpx.HTTPError, ValueError) as e:  # network, timeout, invalid JSON
        raise SttError(f"{name} failed: {type(e).__name__}") from e
    finally:
        if own:
            http.close()
    return Transcription(text.strip(), name, time.perf_counter() - t0, duration, words)
