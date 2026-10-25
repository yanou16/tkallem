"""A call cannot wait for a slow voice: past a few seconds the browser reads the line, and after repeated failures the
server voice is skipped for a while (so each answer does not cost the same wait again)."""
import asyncio
import time
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

from app.config import settings
from app.voice import pipecat_pipeline as pp
from app.voice.tts import Speech, TtsError


def make():
    rtvi = MagicMock()
    rtvi.send_server_message = AsyncMock()
    proc = pp.TkallemVoiceTurnProcessor(session_id=uuid4(), user={}, coach=MagicMock(), connect=MagicMock(), rtvi=rtvi)
    proc.push_frame = AsyncMock()
    return proc, rtvi


def errors(rtvi):
    return [c.args[0] for c in rtvi.send_server_message.await_args_list if c.args[0].get("type") == "error"]


def slow(seconds):
    def run(text, **kw):
        if kw.get("provider") == "piper":
            raise TtsError("the Piper voice is not set up (PIPER_MODEL_PATH is not set or the file is missing)")
        time.sleep(seconds)
        raise AssertionError("a late result must be dropped, not used")
    return run


def test_a_slow_voice_gives_way_to_the_browser_after_the_wait(monkeypatch):
    monkeypatch.setattr(settings, "voice_call_tts_wait_secs", 1.0)
    monkeypatch.setattr(pp, "synthesize", slow(3))
    proc, rtvi = make()
    waited = []

    async def go():
        started = time.monotonic()
        await proc.speak_text("What is the purpose of your trip?")
        waited.append(time.monotonic() - started)  # measured here: closing the loop waits for the abandoned thread

    asyncio.run(go())
    assert waited[0] < 2.0  # did not wait for the 3 s voice
    assert [e["code"] for e in errors(rtvi)] == ["tts_error"]  # the page then speaks the line itself


def test_after_repeated_failures_the_server_voice_is_skipped_at_once(monkeypatch):
    monkeypatch.setattr(settings, "voice_call_tts_failures_to_skip", 2)
    monkeypatch.setattr(settings, "voice_call_tts_skip_secs", 60.0)
    calls = []

    def broken(text, **kw):
        calls.append(text)
        raise TtsError("provider down")

    monkeypatch.setattr(pp, "synthesize", broken)
    proc, rtvi = make()

    async def turns(n):
        for i in range(n):
            await proc.speak_text(f"line {i}")

    asyncio.run(turns(5))
    assert len(calls) == 2  # two real attempts, then the voice is skipped for the next three lines
    assert len(errors(rtvi)) == 5  # every line still gets its browser fallback


def test_a_skipped_attempt_does_not_extend_the_pause_and_the_voice_comes_back(monkeypatch):
    monkeypatch.setattr(settings, "voice_call_tts_failures_to_skip", 1)
    monkeypatch.setattr(settings, "voice_call_tts_skip_secs", 60.0)
    monkeypatch.setattr(pp, "synthesize", lambda text, **kw: (_ for _ in ()).throw(TtsError("down")))
    proc, _ = make()
    asyncio.run(proc.speak_text("one"))
    until = proc._tts_skip_until
    asyncio.run(proc.speak_text("two"))  # skipped
    assert proc._tts_skip_until == until
    proc._tts_skip_until = 0.0  # the pause is over
    wav = open("/dev/null", "rb").read()
    monkeypatch.setattr(pp, "synthesize", lambda text, **kw: Speech([wav], "audio/wav", "groq", 3, 0.1, 0.1))
    asyncio.run(proc.speak_text("three"))  # tried again (it fails on the empty audio, which is fine here)
    assert proc._tts_skip_until == 0.0 or proc._tts_failures >= 1


def test_when_the_usual_voices_are_slow_the_server_voice_says_the_line(monkeypatch):
    monkeypatch.setattr(settings, "voice_call_tts_wait_secs", 1.0)
    import io, wave
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1), w.setsampwidth(2), w.setframerate(22050)
        w.writeframes(b"\x01\x02" * 2205)
    asked = []

    def synth(text, **kw):
        asked.append(kw.get("provider"))
        if kw.get("provider") == "piper":
            return Speech([buf.getvalue()], "audio/wav", "piper", len(text), 0.1, 0.1)
        time.sleep(3)

    monkeypatch.setattr(pp, "synthesize", synth)
    proc, rtvi = make()

    async def go():
        await proc.speak_text("What is the purpose of your trip?")

    asyncio.run(go())
    assert asked == [None, "piper"]  # the usual chain first, then the safety net
    assert errors(rtvi) == []  # no browser fallback needed
    assert proc._tts_failures == 0
    assert proc.push_frame.await_count > 3  # the audio was pushed
