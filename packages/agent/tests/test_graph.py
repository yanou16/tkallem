import json
from pathlib import Path

from tkallem_agent.graph import build_graph

SCENARIO = json.loads((Path(__file__).parents[3] / "apps/api/app/scenarios/visa-us.json").read_text())

GOOD = {
    "reply": "Good. And how will you pay for your studies?",
    "corrections": [{"original": "for study", "fixed": "to study", "type": "grammar", "why_fr": "Le but : to + verbe."}],
    "sentence_status": "orange",
    "goal_covered": "purpose_of_trip",
}
BAD = {k: v for k, v in GOOD.items() if k != "reply"}  # missing required field: invalid even after sanitizing


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
    out = run(FakeLLM([GOOD]))
    assert out["turn"].sentence_status == "orange"
    assert len(out["history"]) == 2


def test_invalid_output_is_retried_once():
    llm = FakeLLM([BAD, GOOD])
    out = run(llm)
    assert llm.calls == 2 and out["turn"].reply.startswith("Good")


def test_gives_up_after_retry_without_turn():
    llm = FakeLLM([BAD, BAD])
    out = run(llm)
    assert llm.calls == 2 and "turn" not in out


def test_coach_follows_scenario_question_order():
    from langchain_core.messages import AIMessage, HumanMessage

    from tkallem_agent.graph import next_step

    qs = SCENARIO["questions"]
    assert qs[1] in next_step(SCENARIO, [])
    done = [HumanMessage("a"), AIMessage("b")] * (len(qs) - 1)
    assert "over" in next_step(SCENARIO, done)


def test_unknown_goal_is_dropped():
    from tkallem_agent.schemas import sanitize

    out = sanitize({**GOOD, "goal_covered": "made_up_goal"}, SCENARIO["goals"])
    assert out["goal_covered"] is None
