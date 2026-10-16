import asyncio
import io
import re
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


def test_pipecat_stt_emits_iso_timestamp_and_complete_settings(monkeypatch):
    monkeypatch.setattr(
        pipecat_pipeline,
        "transcribe",
        lambda audio, filename, content_type: Transcription("hello", "groq", 0.01),
    )

    async def collect():
        service = pipecat_pipeline.TkallemSTTService()
        frames = [frame async for frame in service.run_stt(_wav())]
        return service, frames

    service, frames = asyncio.run(collect())

    assert service._settings.model == pipecat_pipeline.settings.stt_model
    assert service._settings.language == "en"
    assert re.fullmatch(
        r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?\+00:00",
        frames[0].timestamp,
    )


def test_build_voice_pipeline_includes_vad_processor():
    from unittest.mock import MagicMock
    from uuid import uuid4
    from pipecat.processors.audio.vad_processor import VADProcessor
    from pipecat.transports.smallwebrtc.connection import SmallWebRTCConnection

    async def build_and_inspect():
        conn = SmallWebRTCConnection()
        coach = MagicMock()
        coach.opening = "Hello!"
        coach.turns = []

        runner, task, processor = pipecat_pipeline.build_voice_pipeline(
            webrtc_connection=conn,
            session_id=uuid4(),
            user={"id": uuid4(), "level": "B1"},
            coach=coach,
            connect=MagicMock(),
        )

        inner_pipeline = task._pipeline._processors[1]
        processor_types = [type(p) for p in inner_pipeline._processors]
        return runner, processor, processor_types

    runner, processor, processor_types = asyncio.run(build_and_inspect())
    assert VADProcessor in processor_types
    assert pipecat_pipeline.TkallemSTTService in processor_types
    assert pipecat_pipeline.TkallemVoiceTurnProcessor in processor_types
