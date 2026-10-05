import time

from langchain_core.messages import AIMessage, HumanMessage

from fakes import FakeChat
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
    out = run(FakeChat([NONE], [{"reaction": "Good. Why the US?", "goal_covered": None}]))
    assert out["turn"].reply == "Good. " + SCENARIO["questions"][1]


def test_closing_once_then_only_reactions():
    qs = SCENARIO["questions"]
    turn = [HumanMessage("a"), AIMessage("b")]
    last = run(FakeChat([NONE], [GOOD]), history=[AIMessage(qs[0])] + turn * (len(qs) - 1))
    assert last["turn"].reply.endswith("end of the interview.")
    after = run(FakeChat([NONE], [GOOD]), history=[AIMessage(qs[0])] + turn * len(qs))
    assert after["turn"].reply == "Good, you want to study."


def test_question_order():
    sc = {"questions": ["q0", "q1", "q2", "q3"]}
    turn = [HumanMessage("a"), AIMessage("b")]
    assert next_question(sc, []) == "q1"
    assert next_question(sc, [AIMessage("q0")] + turn) == "q2"
    assert next_question(sc, turn * 3) is None


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
