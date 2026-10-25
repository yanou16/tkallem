"""In a call, the coach speaks as soon as its reply exists: the corrections, made at the same time, must not delay it."""
import asyncio
import threading
from contextlib import nullcontext
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from app.voice import pipecat_pipeline as pp


class Coach:
    """turn_events yields the reply, then waits for the test before it yields the corrections and the end of the turn."""

    def __init__(self, gate: threading.Event, fail_after_reply=False):
        self.turns = []
        self.gate = gate
        self.fail_after_reply = fail_after_reply

    def turn_events(self, text):
        yield {"type": "reply", "reply": "What ties do you have to Algeria?"}
        assert self.gate.wait(5), "the test never released the corrections"
        if self.fail_after_reply:
            raise RuntimeError("the corrector failed twice")
        yield {"type": "corrections", "corrections": [{"original": "pay", "fixed": "pays"}], "sentence_status": "orange"}
        yield {"type": "done", "turn": SimpleNamespace(goal_covered="reason")}


def make(coach, monkeypatch):
    rtvi = MagicMock()
    rtvi.send_server_message = AsyncMock()
    proc = pp.TkallemVoiceTurnProcessor(session_id=uuid4(), user={}, coach=coach, connect=lambda: nullcontext(object()), rtvi=rtvi)
    proc.push_frame = AsyncMock()
    proc.start_speaking = MagicMock()
    proc.save_correction = AsyncMock()
    monkeypatch.setattr(pp.credits, "spend", lambda *a, **k: None)
    monkeypatch.setattr(pp.credits, "refund", lambda *a, **k: None)
    return proc, rtvi


def sent(rtvi, kind):
    return [c.args[0] for c in rtvi.send_server_message.await_args_list if c.args[0].get("type") == kind]


def test_the_coach_speaks_before_the_corrections_are_ready(monkeypatch):
    gate = threading.Event()
    proc, rtvi = make(Coach(gate), monkeypatch)

    async def go():
        task = asyncio.create_task(proc.handle_transcription("I want to study in Canada because my father pay."))
        for _ in range(200):  # up to 2 s: the reply must arrive while the corrections are still being held back
            if proc.start_speaking.called:
                break
            await asyncio.sleep(0.01)
        spoke_early = proc.start_speaking.called and not gate.is_set()
        gate.set()
        await task
        return spoke_early

    assert asyncio.run(go()) is True
    proc.start_speaking.assert_called_once_with("What ties do you have to Algeria?")
    assert [e["text"] for e in sent(rtvi, "bot_transcript")] == ["What ties do you have to Algeria?"]
    proc.save_correction.assert_awaited_once()  # the corrections and the saving still happen, after the voice started
    args = proc.save_correction.await_args.args
    assert args[4] == "orange" and args[5] == "reason"


def test_a_failure_after_the_reply_tells_the_student_to_repeat_and_gives_the_credit_back(monkeypatch):
    gate = threading.Event()
    gate.set()
    refunds = []
    proc, rtvi = make(Coach(gate, fail_after_reply=True), monkeypatch)
    monkeypatch.setattr(pp.credits, "refund", lambda *a, **k: refunds.append(1))
    asyncio.run(proc.handle_transcription("Hello."))
    assert refunds == [1]
    assert [e["code"] for e in sent(rtvi, "error")] == ["conversation_error"]
    proc.save_correction.assert_not_awaited()  # nothing is saved for a turn that did not end


def test_a_turn_without_a_reply_still_says_something(monkeypatch):
    class Silent:
        turns = []

        def turn_events(self, text):
            yield {"type": "done", "turn": SimpleNamespace(goal_covered=None)}

    proc, rtvi = make(Silent(), monkeypatch)
    asyncio.run(proc.handle_transcription("Hello."))
    proc.start_speaking.assert_called_once_with("I see. Let's continue.")
