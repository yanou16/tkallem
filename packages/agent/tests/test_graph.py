import time

from langchain_core.messages import AIMessage, HumanMessage

from tkallem_agent.testing import FakeChat
from tkallem_agent.graph import build_graph, clean_reaction, next_question, reaction_problem
from tkallem_agent.scenarios import load_scenario

SCENARIO = load_scenario("visa-us").model_dump()
FREE = load_scenario("free-talk").model_dump()

FOUND = {"corrections": [{"original": "for study", "fixed": "to study", "type": "grammar", "why": "Le but : to + verbe."}]}
NONE = {"corrections": []}
GOOD = {"reaction": "Good, you want to study.", "goal_covered": "purpose_of_trip"}
BAD = {"goal_covered": None}  # missing required "reaction"


def run(llm, scenario=SCENARIO, text="I go to the US for study.", history=None, level="B1"):
    history = history if history is not None else [AIMessage(scenario["questions"][0] if scenario["questions"] else "Hi!")]
    return build_graph(llm).invoke({"level": level, "scenario": scenario, "student_text": text, "history": history})


def test_happy_path_records_history_and_timings():
    out = run(FakeChat([FOUND], [GOOD]))
    assert out["turn"].sentence_status == "orange"
    assert out["turn"].corrections[0].fixed == "to study"
    assert len(out["history"]) == 3  # opening + student + coach
    assert {"correct", "coach"} <= out["timings"].keys()


def test_corrector_and_coach_run_in_parallel():
    llm = FakeChat([NONE], [GOOD], delay=0.4)
    t0 = time.perf_counter()
    run(llm)
    assert time.perf_counter() - t0 < 0.7  # sequential would take >= 0.8s


def test_invalid_coach_output_is_retried_once():
    llm = FakeChat([FOUND], [BAD, GOOD])
    out = run(llm)
    assert llm.calls["Reply"] == 2 and out["turn"].reply.startswith("Good")


def test_gives_up_after_retry_without_turn():
    llm = FakeChat([FOUND], [BAD, BAD])
    out = run(llm)
    assert llm.calls["Reply"] == 2 and "turn" not in out and out["error"]


def test_too_long_reaction_is_rephrased_once_then_accepted():
    long = {"reaction": "That is a really very interesting and quite detailed answer about your plans for the future.", "goal_covered": None}
    llm = FakeChat([NONE], [long, GOOD])
    assert run(llm)["turn"].reply.startswith("Good") and llm.calls["Reply"] == 2
    llm = FakeChat([NONE], [long, long])
    assert run(llm)["turn"].reply.startswith("That is") and llm.calls["Reply"] == 2  # soft: accepted after one retry


def test_reply_ends_with_next_scenario_question_verbatim():
    out = run(FakeChat([FOUND], [GOOD]))
    assert out["turn"].reply == "Good, you want to study. " + SCENARIO["questions"][1]


def test_model_questions_are_dropped_in_guided_mode():
    out = run(FakeChat([NONE], [{"reaction": "Good. Why the US?", "goal_covered": "purpose_of_trip"}]))
    assert out["turn"].reply == "Good. " + SCENARIO["questions"][1]


def conversation(qs, upto):
    """History where the coach asked questions 0..upto-1 and each was answered (as the real coach writes it)."""
    history = [AIMessage(qs[0])]
    for i in range(1, upto):
        history += [HumanMessage("answer"), AIMessage(f"Thanks. {qs[i]}")]
    return history


def test_closing_once_then_only_reactions():
    qs, goals = SCENARIO["questions"], SCENARIO["goals"]
    plans = {"reaction": "Good.", "goal_covered": goals[-1]}
    last = run(FakeChat([NONE], [plans]), history=conversation(qs, len(qs)))
    assert last["turn"].reply.endswith("end of the interview.")
    closed = conversation(qs, len(qs)) + [HumanMessage("answer"), AIMessage("Good. Thank you, that is the end of the interview.")]
    after = run(FakeChat([NONE], [GOOD]), history=closed)
    assert after["turn"].reply == "Good, you want to study."


def test_question_order():
    sc = {"questions": ["q0", "q1", "q2", "q3"], "goals": ["g0", "g1", "g2", "g3"]}
    asked_q0 = [AIMessage("q0")]
    assert next_question(sc, asked_q0, covered={"g0"}) == "q1"
    asked_q1 = asked_q0 + [HumanMessage("a"), AIMessage("ok. q1")]
    assert next_question(sc, asked_q1, covered={"g0", "g1"}) == "q2"
    last = asked_q1 + [HumanMessage("a"), AIMessage("q2"), HumanMessage("a"), AIMessage("q3")]
    assert next_question(sc, last, covered={"g0", "g1", "g2", "g3"}) is None


def test_an_unanswered_question_is_asked_again_once():
    sc = {"questions": ["q0", "q1", "q2"], "goals": ["g0", "g1", "g2"]}
    asked = [AIMessage("q0")]
    assert next_question(sc, asked, covered=set()) == "q0"  # "What do you mean?": the coach explains and asks again
    asked_twice = asked + [HumanMessage("what?"), AIMessage("I mean your reason. q0")]
    assert next_question(sc, asked_twice, covered=set()) == "q1"  # never a third time: the student is not stuck


def test_a_question_answered_earlier_is_not_asked():
    sc = {"questions": ["q0", "q1", "q2", "q3"], "goals": ["g0", "g1", "g2", "g3"]}
    asked_q1 = [AIMessage("q0"), HumanMessage("a"), AIMessage("q1")]
    # the student answered q2 instead of q1: q1 is asked again, then q2 is passed over
    assert next_question(sc, asked_q1, covered={"g0", "g2"}) == "q1"
    asked_q1_again = asked_q1 + [HumanMessage("I am a nurse"), AIMessage("A nurse. q1")]
    assert next_question(sc, asked_q1_again, covered={"g0", "g2", "g1"}) == "q3"


def test_coach_reaction_then_repeated_question_when_the_student_asks_back():
    qs = SCENARIO["questions"]
    help_ = {"reaction": "I mean the reason for your trip.", "goal_covered": None}
    out = run(FakeChat([NONE], [help_]), text="What do you mean?")
    assert out["turn"].reply == f"I mean the reason for your trip. {qs[0]}"


def test_free_talk_keeps_the_model_follow_up_question():
    out = run(FakeChat([NONE], [{"reaction": "Sorry to hear that. What happened?", "goal_covered": None}]), scenario=FREE, text="Yesterday I have a problem at work.")
    assert out["turn"].reply == "Sorry to hear that. What happened?"
    assert out["turn"].goal_covered is None


def test_malformed_correction_is_dropped_not_fatal():
    bad = {"corrections": [{"original": "for study", "fixed": "to study", "why": "x"}, FOUND["corrections"][0]]}  # first lacks "type"
    out = run(FakeChat([bad], [GOOD]))
    assert len(out["turn"].corrections) == 1


def test_reaction_helpers():
    assert reaction_problem("Good.", "A2") is None
    assert reaction_problem("This sentence is clearly far too long for a beginner student.", "A2")
    assert clean_reaction("Nice. Where? Great!", free=False) == "Nice. Great!"


def test_prompts_get_the_level_limits():
    llm = FakeChat([NONE], [GOOD])
    run(llm, level="A2")
    system = llm.seen["Reply"][0][0].content
    assert "max 8 words" in system and "A2" in system


def test_unparseable_coach_output_is_retried():
    from langchain_core.exceptions import OutputParserException

    llm = FakeChat([NONE], [OutputParserException("bad json"), GOOD])
    out = run(llm)
    assert llm.calls["Reply"] == 2 and out["turn"].reply.startswith("Good")


def test_corrector_error_is_retried_once():
    llm = FakeChat([RuntimeError("provider hiccup"), FOUND], [GOOD])
    out = run(llm)
    assert llm.calls["Found"] == 2 and out["turn"].corrections[0].fixed == "to study"


def test_meaning_change_makes_the_sentence_red():
    out = run(FakeChat([{**FOUND, "changes_meaning": True}], [GOOD]))
    assert len(out["turn"].corrections) == 1 and out["turn"].sentence_status == "red"
    out = run(FakeChat([{"corrections": [], "changes_meaning": True}], [GOOD]))
    assert out["turn"].sentence_status == "green"  # red needs a kept correction


def test_corrector_retry_asks_for_compact_output():
    llm = FakeChat([RuntimeError("length limit"), FOUND], [GOOD])
    run(llm)
    assert "compact JSON" in llm.seen["Found"][1][-1].content


def test_coach_retries_after_any_output_error():
    llm = FakeChat([NONE], [RuntimeError("length limit reached"), GOOD])
    assert run(llm)["turn"].reply.startswith("Good") and llm.calls["Reply"] == 2
    llm = FakeChat([NONE], [RuntimeError("x"), RuntimeError("x")])
    assert "turn" not in run(llm)


def test_missing_corrector_payload_retries_instead_of_marking_clean():
    import pytest
    with pytest.raises(ValueError, match="invalid corrector response"):
        run(FakeChat([{}, {}], [GOOD]))


def test_shared_corrector_requests_spelling_checks_and_preserves_names():
    from tkallem_agent.graph import CORRECTOR_PROMPT
    assert "'helo' becomes 'hello'" in CORRECTOR_PROMPT
    assert "'hallo'" in CORRECTOR_PROMPT
    assert "Preserve proper names" in CORRECTOR_PROMPT
