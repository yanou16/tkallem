import asyncio
import json

import pytest

from fakes import FakeChat
from tkallem_agent import AgentError, CoachSession, ScenarioNotFound
from tkallem_agent.scenarios import load_scenario

FOUND = {"corrections": [{"original": "for study", "fixed": "to study", "type": "grammar", "why": "Le but : to + verbe."}]}
NONE = {"corrections": []}


def reply(text="Good."):
    return {"reaction": text, "goal_covered": None}


def test_full_guided_session_and_report():
    qs = load_scenario("visa-us").questions
    llm = FakeChat([FOUND] + [NONE] * 5, [reply()] * 6, text=["Honest note."])
    s = CoachSession("visa-us", "B1", "fr", llm=llm)
    assert s.opening == qs[0]
    first = s.turn("I go to the US for study.", audio_seconds=3)
    assert first.reply == f"Good. {qs[1]}" and first.sentence_status == "orange"
    for _ in range(5):
        s.turn("My answer is fine.", audio_seconds=2)
    assert s.finished and s.turns[-1].reply.endswith("end of the interview.")
    report = s.end()
    assert report.note == "Honest note." and report.metrics["speaking_seconds"] == 13
    assert [l["role"] for l in report.lines][:2] == ["coach", "student"] and report.lines[-1]["role"] == "coach"
    assert "total" in s.turns[0].timings


def test_coach_sees_the_opening_question_in_its_history():
    llm = FakeChat([NONE], [reply()])
    s = CoachSession("visa-us", "B1", llm=llm)
    s.turn("Hello.")
    messages = llm.seen["Reply"][0]
    assert messages[1].content == s.opening  # system prompt, then the opening question


def test_state_roundtrip_continues_the_same_conversation():
    llm = FakeChat([NONE, NONE], [reply(), reply()])
    s = CoachSession("visa-us", "B2", "en", llm=llm, session_id="abc")
    s.turn("To study computer science.")
    saved = json.loads(json.dumps(s.to_state()))  # must survive JSON storage
    again = CoachSession.from_state(saved, llm=llm)
    assert again.session_id == "abc" and again.level == "B2" and len(again.turns) == 1
    turn = again.turn("Georgia Tech, computer science.")
    assert turn.reply.endswith(load_scenario("visa-us").questions[2])


def test_input_validation():
    s = CoachSession("visa-us", "B1", llm=FakeChat())
    with pytest.raises(ValueError):
        s.turn("   ")
    with pytest.raises(ValueError):
        s.turn("word " * 400)
    with pytest.raises(ValueError):
        CoachSession("visa-us", "B3", llm=FakeChat())
    with pytest.raises(ValueError):
        CoachSession("visa-us", "B1", "de", llm=FakeChat())
    with pytest.raises(ScenarioNotFound):
        CoachSession("mars-mission", "B1", llm=FakeChat())
    with pytest.raises(ValueError):
        CoachSession.from_state({"version": 99})


def test_provider_error_and_invalid_output_raise_agent_error_without_recording():
    s = CoachSession("visa-us", "B1", llm=FakeChat([NONE], [RuntimeError("provider down")]))
    with pytest.raises(AgentError):
        s.turn("Hello.")
    s = CoachSession("visa-us", "B1", llm=FakeChat([NONE], [{}, {}]))
    with pytest.raises(AgentError):
        s.turn("Hello.")
    assert s.turns == []  # a failed turn is not recorded: the student can retry the same answer


def test_speaking_seconds_only_when_every_answer_was_spoken():
    s = CoachSession("free-talk", "A2", llm=FakeChat([NONE, NONE], [reply("Nice! What else?")] * 2))
    s.turn("I wake up late.", audio_seconds=2.5)
    s.turn("I miss the bus.")  # typed
    assert s.speaking_seconds() is None
    assert s.opening == load_scenario("free-talk").opening and not s.finished


def test_async_wrappers():
    s = CoachSession("visa-us", "B1", llm=FakeChat([NONE], [reply()], text=["ok"]))
    turn = asyncio.run(s.aturn("To study."))
    assert turn.reply.startswith("Good.")
    assert asyncio.run(s.aend()).note == "ok"


def test_turn_events_give_the_reply_before_slow_corrections():
    import threading

    gate = threading.Event()

    class SlowCorrector(FakeChat):
        def with_structured_output(self, schema, **kwargs):
            bound = super().with_structured_output(schema, **kwargs)
            if schema["title"] != "Found":
                return bound

            class Slow:
                def invoke(self, messages, config=None):
                    gate.wait(2)  # released only once the reply event was received
                    return bound.invoke(messages, config)

            return Slow()

    s = CoachSession("visa-us", "B1", llm=SlowCorrector([FOUND], [reply()]))
    events = []
    for e in s.turn_events("I go to the US for study."):
        events.append(e["type"])
        if e["type"] == "reply":
            gate.set()
    assert events == ["reply", "corrections", "done"]
    done = s.turns[-1]
    assert done.status == "orange" and done.timings["reply_ready"] <= done.timings["total"]


def test_turn_events_failure_records_nothing():
    s = CoachSession("visa-us", "B1", llm=FakeChat([FOUND], [{}, {}]))
    with pytest.raises(AgentError):
        list(s.turn_events("I go to the US for study."))
    assert s.turns == []


def test_hedged_invoke_returns_the_faster_duplicate():
    import time as _time

    from tkallem_agent.graph import hedged_invoke

    class Flaky:
        def __init__(self):
            self.n = 0

        def invoke(self, messages, config=None):
            self.n += 1
            if self.n == 1:
                _time.sleep(1.5)  # slow provider
                return "slow"
            return "fast"

    t0 = _time.perf_counter()
    assert hedged_invoke(Flaky(), [], after=0.2) == "fast"
    assert _time.perf_counter() - t0 < 1.0
    assert hedged_invoke(Flaky(), [], after=0) == "slow"  # 0 disables hedging


def test_corrector_failing_twice_raises_and_records_nothing():
    s = CoachSession("visa-us", "B1", llm=FakeChat([RuntimeError("down"), RuntimeError("down")], [reply()]))
    with pytest.raises(AgentError):
        s.turn("I go to the US for study.")
    assert s.turns == []


def test_text_limit_comes_from_the_caller():
    s = CoachSession("visa-us", "B1", llm=FakeChat([NONE], [reply()]), max_text_chars=2000)
    s.turn("word " * 300)  # 1500 characters: accepted with the API's own limit
    with pytest.raises(ValueError):
        CoachSession("visa-us", "B1", llm=FakeChat(), max_text_chars=10).turn("a long answer here")
    assert CoachSession.from_state(s.to_state(), llm=FakeChat(), max_text_chars=2000).max_text_chars == 2000


def test_turn_events_carry_the_meaning_status():
    s = CoachSession("visa-us", "B1", llm=FakeChat([{**FOUND, "changes_meaning": True}], [reply()]))
    events = {e["type"]: e for e in s.turn_events("I go to the US for study.")}
    assert events["corrections"]["sentence_status"] == "red" and events["done"]["turn"].sentence_status == "red"


def test_missing_llm_key_is_an_agent_error_not_a_crash(monkeypatch):
    from tkallem_agent import llm as llm_module
    from tkallem_agent.session import TurnLog

    monkeypatch.setenv("LLM_PROVIDER", "openrouter")
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    monkeypatch.setattr(llm_module, "_load_dotenv_once", lambda: None)  # no .env in this test
    llm_module.default_llm.cache_clear()
    s = CoachSession("visa-us", "B1")  # llm=None: built from the environment, like the API does
    with pytest.raises(AgentError, match="not configured"):
        s.turn("I go to the US for study.")
    s.turns.append(TurnLog("I go to the US to study.", "Good.", [], "green"))
    with pytest.raises(AgentError, match="not configured"):
        s.end()


def test_pauses_are_stored_validated_and_survive_the_state_roundtrip():
    s = CoachSession("visa-us", "B1", llm=FakeChat([NONE, NONE], [reply(), reply()], text=["ok"]))
    s.turn("I go to the US.", audio_seconds=30, pauses=3)
    s.turn("To study.", audio_seconds=30)  # default: no pause information
    again = CoachSession.from_state(json.loads(json.dumps(s.to_state())), llm=s.llm)
    assert [t.pauses for t in again.turns] == [3, 0]
    assert again.end().metrics["hesitations_per_min"] == 3.0  # 3 pauses / 1 minute of speech
    with pytest.raises(ValueError):
        s.turn("Hello again.", pauses=-1)
