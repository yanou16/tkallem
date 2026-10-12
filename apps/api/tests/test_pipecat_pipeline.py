import asyncio
import io
import wave

from app.voice import pipecat_pipeline
from app.voice.stt import Transcription


def _wav() -> bytes:
    output = io.BytesIO()
    with wave.open(output, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(16000)
        wav.writeframes(b"\x01\x00" * 1600)
    return output.getvalue()


def test_pipecat_stt_sends_pipecat_wav_directly_to_provider(monkeypatch):
    received: list[bytes] = []

    def fake_transcribe(audio, filename, content_type):
        received.append(audio)
        return Transcription("hello", "groq", 0.01)

    monkeypatch.setattr(pipecat_pipeline, "transcribe", fake_transcribe)

    async def collect():
        return [frame async for frame in pipecat_pipeline.TkallemSTTService().run_stt(_wav())]

    frames = asyncio.run(collect())

    assert len(frames) == 1
    assert received[0].startswith(b"RIFF")
    assert received[0][44:48] != b"RIFF"
