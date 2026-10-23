import asyncio
import json

import pytest

from tkallem_agent.testing import FakeChat
from tkallem_agent import AgentError, CoachSession, ScenarioNotFound
from tkallem_agent.scenarios import load_scenario

FOUND = {"corrections": [{"original": "for study", "fixed": "to study", "type": "grammar", "why": "Le but : to + verbe."}]}
NONE = {"corrections": []}


GOALS = load_scenario("visa-us").goals


def reply(text="Good.", goal=None):
    """Fake coach output. `goal`: the goal the answer covered (None = the student did not answer the question)."""
    return {"reaction": text, "goal_covered": goal}


def test_full_guided_session_and_report():
    qs = load_scenario("visa-us").questions
    llm = FakeChat([FOUND] + [NONE] * 5, [reply(goal=g) for g in GOALS], text=["Honest note."])
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
    llm = FakeChat([NONE, NONE], [reply(goal=GOALS[0]), reply(goal=GOALS[1])])
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


def test_coach_skips_study_questions_when_the_student_does_not_study():
    qs = load_scenario("visa-us").questions
    skip = {"reaction": "I see, you will work.", "goal_covered": "purpose_of_trip", "skip_next": True}
    llm = FakeChat([NONE] * 3, [skip, reply(goal="ties_to_algeria"), reply(goal="plans_after")])
    s = CoachSession("visa-us", "B1", "fr", llm=llm)
    first = s.turn("I go to work, not to study.")
    assert first.reply.endswith(qs[4])  # university, funding and why-abroad are skipped: ties to Algeria
    second = s.turn("My family lives in Oran.")
    assert second.reply.endswith(qs[5])
    s.turn("I will keep my job.")
    assert s.finished


def test_a_question_not_marked_skippable_is_never_skipped():
    qs = load_scenario("visa-us").questions
    skip = {"reaction": "Fine.", "goal_covered": None, "skip_next": True}
    llm = FakeChat([NONE] * 3, [skip, skip, skip])
    s = CoachSession("visa-us", "B1", "fr", llm=llm)
    s.turn("a")
    assert s.turns[-1].reply.endswith(qs[4])
    s.turn("b")
    assert s.turns[-1].reply.endswith(qs[5])  # ties_to_algeria is not skippable, so the plans question follows it
    s.turn("c")
    assert s.finished


def test_skipping_survives_the_state_roundtrip():
    qs = load_scenario("visa-us").questions
    skip = {"reaction": "OK.", "goal_covered": None, "skip_next": True}
    s = CoachSession("visa-us", "B1", "fr", llm=FakeChat([NONE] * 2, [skip, reply()]))
    s.turn("I work.")
    again = CoachSession.from_state(s.to_state(), llm=FakeChat([NONE], [reply(goal="ties_to_algeria")]))
    assert again.turn("My family is here.").reply.endswith(qs[5])


def test_study_studies_swap_is_not_a_correction():
    from tkallem_agent.schemas import sanitize
    raw = {"corrections": [{"original": "not studies", "fixed": "not study", "type": "grammar", "why": "x"}], "sentence_status": "orange"}
    assert sanitize(raw, None, "it's not studies")["corrections"] == []


def test_backup_model_answers_when_the_main_one_fails():
    from tkallem_agent.llm import FallbackChat
    broken = FakeChat([RuntimeError("429"), RuntimeError("429")], [RuntimeError("429"), RuntimeError("429")], text=[RuntimeError("429")])
    backup = FakeChat([NONE, NONE], [reply(), reply()], text=["Backup note."])
    s = CoachSession("visa-us", "B1", "fr", llm=FallbackChat([broken, backup]))
    turn = s.turn("I live in Algiers.")
    assert turn.reply.startswith("Good.") and turn.corrections == []
    assert broken.calls["Reply"] == 1 and backup.calls["Reply"] == 1


def test_when_every_model_fails_the_error_reaches_the_api():
    from tkallem_agent.llm import FallbackChat
    down = lambda: FakeChat([RuntimeError("x")] * 2, [RuntimeError("x")] * 2)
    s = CoachSession("visa-us", "B1", "fr", llm=FallbackChat([down(), down()]))
    with pytest.raises(AgentError):
        s.turn("Hello.")
    assert s.turns == []


def test_fallback_list_is_parsed():
    from tkallem_agent.llm import parse_fallbacks
    assert parse_fallbacks("groq:openai/gpt-oss-120b, openrouter:a/b") == [("groq", "openai/gpt-oss-120b"), ("openrouter", "a/b")]
    assert parse_fallbacks("") == []
    with pytest.raises(ValueError):
        parse_fallbacks("nonsense")


def test_clarification_question_gets_the_question_again_then_the_interview_goes_on():
    qs = load_scenario("visa-us").questions
    llm = FakeChat([NONE] * 3, [reply("I mean the reason of your trip."), reply("I see.", goal=None), reply(goal=GOALS[1])])
    s = CoachSession("visa-us", "B1", "fr", llm=llm)
    assert s.turn("What do you mean?").reply == f"I mean the reason of your trip. {qs[0]}"
    assert s.turn("Hmm.").reply.endswith(qs[1])  # asked twice already: the interview moves on
    assert not s.finished


def test_an_answer_given_in_advance_is_not_asked_again_after_a_roundtrip():
    qs = load_scenario("visa-business").questions
    goals = load_scenario("visa-business").goals
    llm = FakeChat([NONE] * 3, [reply(goal=goals[0]), reply("You are a developer.", goal="occupation"), reply(goal="length_of_stay")])
    s = CoachSession("visa-business", "B1", "fr", llm=llm)
    s.turn("A conference in Boston.")
    assert s.turn("I am a software developer.").reply == f"You are a developer. {qs[1]}"  # length not answered yet
    again = CoachSession.from_state(s.to_state(), llm=llm)
    assert again.turn("Two weeks.").reply.endswith(qs[3])  # occupation (q2) already answered: straight to funding


def test_one_answer_can_cover_two_questions_and_both_are_remembered():
    qs = load_scenario("visa-business").questions
    two = {"reaction": "A conference, for two weeks.", "goal_covered": "purpose_of_trip", "also_covered": ["length_of_stay", "not_a_goal"]}
    s = CoachSession("visa-business", "B1", "fr", llm=FakeChat([NONE], [two]))
    assert s.turn("A conference in Boston, for two weeks.").reply.endswith(qs[2])  # length of stay not asked
    again = CoachSession.from_state(s.to_state(), llm=FakeChat([NONE], [reply(goal="occupation")]))
    assert again.turns[0].also_covered == ["length_of_stay"]  # unknown ids dropped, kept across requests
    assert again.turn("I am a nurse.").reply.endswith(qs[3])


def test_an_empty_structured_answer_from_the_coach_is_retried_not_a_crash():
    # Seen in CI: the provider answered without the structured output (None, no error) and the turn crashed with
    # "TypeError: 'NoneType' object is not subscriptable" instead of asking again.
    llm = FakeChat(found=[{"corrections": []}], replies=[None, {"reaction": "Good.", "goal_covered": "purpose_of_trip"}])
    turn = CoachSession("visa-us", "B1", llm=llm).turn("I want to study in the US.")
    assert turn.reply.startswith("Good.")
    assert llm.calls["Reply"] == 2


def test_the_streamed_corrections_carry_the_checked_praise_and_priority():
    found = {"corrections": [{"original": "for study", "fixed": "to study", "type": "grammar", "why": "x"}],
             "praise": "Clear goal: you go to the US.", "priority_index": 0}
    llm = FakeChat(found=[found], replies=[{"reaction": "Good.", "goal_covered": "purpose_of_trip"}])
    events = list(CoachSession("visa-us", "B1", llm=llm).turn_events("I go to the US for study."))
    corrections = next(e for e in events if e["type"] == "corrections")
    assert corrections["praise"] == "Clear goal: you go to the US." and corrections["priority_index"] == 0
    done = events[-1]["turn"]
    assert done.praise == "Clear goal: you go to the US."


def test_an_invented_praise_never_reaches_the_student():
    found = {"corrections": [], "praise": "Great detail about your scholarship in Paris."}
    llm = FakeChat(found=[found], replies=[{"reaction": "Good.", "goal_covered": "purpose_of_trip"}])
    s = CoachSession("visa-us", "B1", llm=llm)
    assert s.turn("I want to study computer science.").praise is None
    assert s.turns[0].praise is None


def test_multiple_mistakes_survive_stream_and_saved_session():
    fixes = [
        {"original": "dai", "fixed": "day", "type": "vocabulary", "why": "The spelling is day.", "rule": "other"},
        {"original": "were", "fixed": "was", "type": "grammar", "why": "Day is singular: use was.", "rule": "subject_verb_agreement"},
    ]
    llm = FakeChat(found=[{"corrections": fixes, "priority_index": 1}], replies=[reply("What did you do?")])
    session = CoachSession("free-talk", "A2", "en", llm=llm)
    events = list(session.turn_events("my dai were good"))
    streamed = next(e for e in events if e["type"] == "corrections")
    assert streamed["corrections"] == fixes
    assert streamed["priority_index"] == 1
    assert [c.model_dump() for c in events[-1]["turn"].corrections] == fixes
    restored = CoachSession.from_state(json.loads(json.dumps(session.to_state())), llm=FakeChat())
    assert restored.turns[0].corrections == fixes
    corrected = "my dai were good"
    for c in restored.turns[0].corrections:
        corrected = corrected.replace(c["original"], c["fixed"])
    assert corrected == "my day was good"
