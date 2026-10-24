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


def test_later_transcription_is_kept_until_previous_turn_finishes():
    from unittest.mock import MagicMock
    from uuid import uuid4

    async def exercise():
        processor = pipecat_pipeline.TkallemVoiceTurnProcessor(
            session_id=uuid4(), user={}, coach=MagicMock(), connect=MagicMock(), rtvi=MagicMock(),
        )
        started = asyncio.Event()
        release = asyncio.Event()
        handled = []

        async def handle(text):
            handled.append(text)
            if text == "first":
                started.set()
                await release.wait()

        processor.handle_transcription = handle
        processor.queue_transcription("first")
        await started.wait()
        processor.queue_transcription("second")
        processor.queue_transcription("third")
        assert handled == ["first"]
        release.set()
        await processor._current_turn_task
        assert handled == ["first", "second", "third"]
        assert not processor._pending_transcriptions

    asyncio.run(exercise())


def test_voice_pause_window_is_configurable_and_validated():
    import pytest
    from app.config import Settings
    from pydantic import ValidationError
    assert Settings(_env_file=None, voice_turn_silence_secs=1.8).voice_turn_silence_secs == 1.8
    with pytest.raises(ValidationError):
        Settings(_env_file=None, voice_turn_silence_secs=0)


def test_voice_reply_starts_before_slow_corrections_and_saves_all_fixes(monkeypatch):
    import threading
    from types import SimpleNamespace
    from unittest.mock import AsyncMock, MagicMock
    from uuid import uuid4

    release = threading.Event()
    fixes = [{"original": "dai", "fixed": "day"}, {"original": "were", "fixed": "was"}]
    coach = MagicMock()
    coach.turns = []
    def events(text):
        yield {"type": "reply", "reply": "What did you do?"}
        assert release.wait(3), "correction was never released"
        yield {"type": "corrections", "corrections": fixes, "sentence_status": "orange"}
        yield {"type": "done", "turn": SimpleNamespace(goal_covered="day")}
    coach.turn_events.side_effect = events
    monkeypatch.setattr(pipecat_pipeline.credits, "spend", MagicMock())

    async def exercise():
        processor = pipecat_pipeline.TkallemVoiceTurnProcessor(
            session_id=uuid4(), user={}, coach=coach, connect=MagicMock(), rtvi=MagicMock())
        reply_sent = asyncio.Event()
        async def send(payload):
            if payload["type"] == "bot_transcript":
                reply_sent.set()
        processor.send_event = AsyncMock(side_effect=send)
        processor.start_speaking = MagicMock()
        processor.save_correction = AsyncMock()
        task = asyncio.create_task(processor.handle_transcription("my dai were good"))
        try:
            await asyncio.wait_for(reply_sent.wait(), 2)
            processor.start_speaking.assert_called_once_with("What did you do?")
            processor.save_correction.assert_not_called()
        finally:
            release.set()
            await asyncio.wait_for(task, 3)
        args = processor.save_correction.call_args.args
        assert args[1:] == ("my dai were good", "What did you do?", fixes, "orange", "day", 0)
        processor.save_correction.assert_awaited_once()
    asyncio.run(exercise())


def test_voice_late_graph_failure_stops_speech_and_does_not_save(monkeypatch):
    from unittest.mock import AsyncMock, MagicMock
    from uuid import uuid4
    coach = MagicMock()
    coach.turns = []
    def events(text):
        yield {"type": "reply", "reply": "Hello!"}
        raise RuntimeError("corrector unavailable")
    coach.turn_events.side_effect = events
    monkeypatch.setattr(pipecat_pipeline.credits, "spend", MagicMock())
    refund = MagicMock()
    monkeypatch.setattr(pipecat_pipeline.credits, "refund", refund)
    async def exercise():
        processor = pipecat_pipeline.TkallemVoiceTurnProcessor(
            session_id=uuid4(), user={}, coach=coach, connect=MagicMock(), rtvi=MagicMock())
        processor.send_event = AsyncMock()
        processor.start_speaking = MagicMock()
        processor.interrupt_speech = MagicMock()
        processor.save_correction = AsyncMock()
        await processor.handle_transcription("hello")
        processor.start_speaking.assert_called_once_with("Hello!")
        processor.interrupt_speech.assert_called_once()
        processor.save_correction.assert_not_called()
        assert processor.send_event.call_args.args[0]["code"] == "conversation_error"
        refund.assert_called_once()
    asyncio.run(exercise())
