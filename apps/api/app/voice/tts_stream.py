"""Incremental WAV-to-PCM synthesis for WebRTC; buffered HTTP callers keep tts.py.

Groq WAV bytes are consumed as they arrive. DeepInfra remains a buffered backup.
Never restart a reply on another provider once any PCM has been emitted.
"""
import asyncio
import audioop
from contextlib import aclosing
import struct
from collections.abc import AsyncIterator

import httpx

from app.config import settings
from app.voice import failover
from app.voice.errors import provider_message
from app.voice.tts import GROQ_VOICE, TtsError, _budget, split_text, synthesize


class WavStream:
    """Parse split RIFF headers and preserve sample/resampler boundaries across packets."""
    def __init__(self):
        self.buffer = bytearray()
        self.riff = False
        self.fmt = None
        self.remaining = None
        self.rate_state = None
        self.samples = 0

    def feed(self, data: bytes) -> bytes:
        self.buffer.extend(data)
        if not self.riff:
            if len(self.buffer) < 12:
                return b""
            if self.buffer[:4] != b"RIFF" or self.buffer[8:12] != b"WAVE":
                raise TtsError("stream did not contain a WAV file")
            del self.buffer[:12]
            self.riff = True
        while self.remaining is None:
            if len(self.buffer) < 8:
                return b""
            kind, size = bytes(self.buffer[:4]), struct.unpack_from("<I", self.buffer, 4)[0]
            if kind == b"data":
                if self.fmt is None:
                    raise TtsError("WAV stream has data before format")
                del self.buffer[:8]
                self.remaining = size
                break
            if size > 65536:
                raise TtsError("WAV stream header is too large")
            length = 8 + size + (size & 1)
            if len(self.buffer) < length:
                return b""
            if kind == b"fmt ":
                if size < 16:
                    raise TtsError("WAV stream format is incomplete")
                tag, channels, rate, _, _, bits = struct.unpack_from("<HHIIHH", self.buffer, 8)
                if tag != 1 or channels not in (1, 2) or bits != 16 or not 8000 <= rate <= 192000:
                    raise TtsError("WAV streaming requires 16-bit mono or stereo PCM")
                self.fmt = channels, rate
            del self.buffer[:length]
        channels, rate = self.fmt
        count = min(len(self.buffer), self.remaining)
        count -= count % (2 * channels)
        pcm = bytes(self.buffer[:count])
        del self.buffer[:count]
        self.remaining -= count
        self.samples += count
        if channels == 2:
            pcm = audioop.tomono(pcm, 2, 0.5, 0.5)
        if pcm and rate != 16000:
            pcm, self.rate_state = audioop.ratecv(pcm, 2, 1, rate, 16000, self.rate_state)
        return pcm

    def finish(self):
        if not self.samples or self.remaining not in (0, 0xFFFFFFFF - self.samples) or (self.buffer and self.remaining):
            raise TtsError("WAV audio stream ended prematurely")


async def _groq_pcm(text: str, client: httpx.AsyncClient) -> AsyncIterator[bytes]:
    if not settings.groq_api_key:
        raise TtsError("GROQ_API_KEY is not set")
    # Keep sentence order; each request is consumed before starting the next.
    for part in split_text(text):
        decoder = WavStream()
        async with client.stream("POST", "https://api.groq.com/openai/v1/audio/speech",
            headers={"Authorization": f"Bearer {settings.groq_api_key}"},
            json={"model": "canopylabs/orpheus-v1-english", "input": part,
                  "voice": GROQ_VOICE, "response_format": "wav"}, timeout=_budget()) as response:
            if response.is_error:
                await response.aread()
                raise TtsError(f"groq answered {response.status_code}{provider_message(response)}", response.status_code)
            async for packet in response.aiter_bytes():
                pcm = decoder.feed(packet)
                if pcm:
                    yield pcm
            decoder.finish()


async def stream_speech(text: str, *, client: httpx.AsyncClient | None = None) -> AsyncIterator[bytes]:
    """Yield mono 16kHz PCM before response completion; cancellation closes the HTTP request."""
    text = " ".join(text.split())
    if not text:
        raise TtsError("empty text")
    owned = client is None
    http = client or httpx.AsyncClient(timeout=_budget())
    emitted = False
    errors = []
    try:
        for name in failover.ordered("tts", failover.names(settings.tts_provider)):
            try:
                if name == "groq":
                    async with aclosing(_groq_pcm(text, http)) as audio:
                        async for pcm in audio:
                            emitted = True
                            yield pcm
                else:
                    # Providers without a streaming integration retain the existing fallback.
                    speech = await asyncio.to_thread(synthesize, text, provider=name)
                    if speech.mime != "audio/wav":
                        raise TtsError("backup voice did not return WAV audio")
                    decoder = WavStream()
                    pcm = decoder.feed(speech.audio)
                    decoder.finish()
                    if pcm:
                        emitted = True
                        yield pcm
                failover.mark_ok("tts", name)
                return
            except (TtsError, httpx.HTTPError, ValueError) as exc:
                status = getattr(exc, "status", None)
                failover.mark_down("tts", name, status)
                if emitted:
                    raise TtsError("Voice stream interrupted; reply was not restarted", status) from exc
                errors.append(str(exc))
        raise TtsError("; ".join(errors) or "no TTS provider configured")
    finally:
        if owned:
            await http.aclose()
