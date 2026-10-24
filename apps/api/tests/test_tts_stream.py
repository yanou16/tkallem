import asyncio
import audioop
import io
import wave
from unittest.mock import MagicMock

import httpx
import pytest

from app.voice import failover, tts_stream
from app.voice.tts import Speech, TtsError


def wav(rate=16000, channels=1):
    out = io.BytesIO()
    with wave.open(out, "wb") as f:
        f.setnchannels(channels)
        f.setsampwidth(2)
        f.setframerate(rate)
        f.writeframes(b"\x01\x00\x03\x00" * 100)
    return out.getvalue()


@pytest.fixture(autouse=True)
def config(monkeypatch):
    monkeypatch.setattr(tts_stream.settings, "groq_api_key", "test-key")
    monkeypatch.setattr(tts_stream.settings, "tts_provider", "groq,deepinfra")
    failover.reset()
    yield
    failover.reset()


@pytest.mark.parametrize("rate,channels", [(16000, 1), (24000, 1), (24000, 2)])
def test_wav_headers_and_samples_can_cross_any_packet_boundary(rate, channels):
    data = wav(rate, channels)
    decoder = tts_stream.WavStream()
    actual = b"".join(decoder.feed(data[i:i+7]) for i in range(0, len(data), 7))
    decoder.finish()
    expected = data[44:]
    if channels == 2:
        expected = audioop.tomono(expected, 2, 0.5, 0.5)
    if rate != 16000:
        expected, _ = audioop.ratecv(expected, 2, 1, rate, 16000, None)
    assert actual == expected


def test_streaming_wav_unknown_length_and_truncation():
    data = bytearray(wav())
    data[40:44] = b"\xff" * 4
    decoder = tts_stream.WavStream()
    assert decoder.feed(data) == bytes(data[44:])
    decoder.finish()
    decoder = tts_stream.WavStream()
    decoder.feed(wav()[:-10])
    with pytest.raises(TtsError, match="prematurely"):
        decoder.finish()


class AudioPackets(httpx.AsyncByteStream):
    def __init__(self, fail=False):
        self.closed = False
        self.finished = False
        self.fail = fail
    async def __aiter__(self):
        data = wav()
        yield data[:100]
        if self.fail:
            raise httpx.ReadError("connection lost")
        self.finished = True
        yield data[100:]
    async def aclose(self):
        self.closed = True


def test_first_pcm_arrives_before_download_finishes_and_closing_stops_download():
    async def exercise():
        packets = AudioPackets()
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda r: httpx.Response(200, stream=packets))) as client:
            audio = tts_stream.stream_speech("Hello!", client=client)
            first = await anext(audio)
            assert first == wav()[44:100]
            assert not packets.finished
            await audio.aclose()
            assert packets.closed
            assert not packets.finished
    asyncio.run(exercise())


def test_failure_before_first_audio_uses_backup(monkeypatch):
    backup = MagicMock(return_value=Speech([wav()], "audio/wav", "deepinfra", 6, 0.1, 0.1))
    monkeypatch.setattr(tts_stream, "synthesize", backup)
    async def exercise():
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda r: httpx.Response(429, json={"error": "quota"}))) as client:
            return b"".join([p async for p in tts_stream.stream_speech("Hello!", client=client)])
    assert asyncio.run(exercise()) == wav()[44:]
    backup.assert_called_once_with("Hello!", provider="deepinfra")


def test_failure_after_first_audio_does_not_restart_reply(monkeypatch):
    backup = MagicMock()
    monkeypatch.setattr(tts_stream, "synthesize", backup)
    async def exercise():
        packets = AudioPackets(fail=True)
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda r: httpx.Response(200, stream=packets))) as client:
            audio = tts_stream.stream_speech("Hello!", client=client)
            assert await anext(audio)
            with pytest.raises(TtsError, match="not restarted"):
                await anext(audio)
            assert packets.closed
    asyncio.run(exercise())
    backup.assert_not_called()
