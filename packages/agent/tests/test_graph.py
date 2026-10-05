import json
from pathlib import Path

from tkallem_agent.graph import build_graph

SCENARIO = json.loads((Path(__file__).parents[3] / "apps/api/app/scenarios/visa-us.json").read_text())

FOUND = {"corrections": [{"original": "for study", "fixed": "to study", "type": "grammar", "why_fr": "Le but : to + verbe."}]}
GOOD = {"reaction": "Good, you want to study.", "goal_covered": "purpose_of_trip"}
BAD = {"goal_covered": None}  # missing required "reaction"


class FakeLLM:
    def __init__(self, outputs):
        self.outputs = list(outputs)
        self.calls = 0

    def with_structured_output(self, *a, **k):
        return self

    def invoke(self, messages):
        self.calls += 1
        return self.outputs.pop(0)


def run(llm):
    return build_graph(llm).invoke(
        {"level": "B1", "scenario": SCENARIO, "student_text": "I go to the US for study.", "history": []}
    )


def test_happy_path_records_history():
    out = run(FakeLLM([FOUND, GOOD]))
    assert out["turn"].sentence_status == "orange"
    assert out["turn"].corrections[0].fixed == "to study"
    assert len(out["history"]) == 2


def test_invalid_coach_output_is_retried_once():
    llm = FakeLLM([FOUND, BAD, GOOD])
    out = run(llm)
    assert llm.calls == 3 and out["turn"].reply.startswith("Good")


def test_gives_up_after_retry_without_turn():
    llm = FakeLLM([FOUND, BAD, BAD])
    out = run(llm)
    assert llm.calls == 3 and "turn" not in out


def test_reply_ends_with_next_scenario_question_verbatim():
    out = run(FakeLLM([FOUND, GOOD]))
    assert out["turn"].reply == "Good, you want to study. " + SCENARIO["questions"][1]


def test_coach_follows_scenario_question_order_then_closes():
    from langchain_core.messages import AIMessage, HumanMessage

    from tkallem_agent.graph import next_question

    qs = ["q0", "q1", "q2", "q3"]
    sc = {"questions": qs}
    turn = [HumanMessage("a"), AIMessage("b")]
    assert next_question(sc, []) == "q1"
    assert next_question(sc, turn) == "q2"
    assert next_question(sc, turn * 2) == "q3"
    assert next_question(sc, turn * 3) is None


def test_unknown_goal_is_dropped():
    from tkallem_agent.schemas import sanitize

    out = sanitize({**GOOD, "corrections": [], "sentence_status": "green", "goal_covered": "made_up_goal"}, SCENARIO["goals"])
    assert out["goal_covered"] is None


def test_free_talk_has_no_fixed_question_and_no_closing():
    free = json.loads((Path(__file__).parents[3] / "apps/api/app/scenarios/free-talk.json").read_text())
    out = build_graph(FakeLLM([FOUND, {"reaction": "Sorry to hear that. What happened?", "goal_covered": None}])).invoke(
        {"level": "B1", "scenario": free, "student_text": "Yesterday I have a problem at work.", "history": []}
    )
    assert out["turn"].reply == "Sorry to hear that. What happened?"
    assert out["turn"].goal_covered is None
