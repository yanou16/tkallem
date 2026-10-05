import json
from pathlib import Path

from tkallem_agent.cefr import distance, llm_estimator, parse_level


def test_parse_level():
    assert parse_level("B2") == "B2" and parse_level("I think it's b1.") == "B1"
    assert parse_level("no idea") is None


def test_distance():
    assert distance("B1", "B2") == 1 and distance("A2", "C1") == 3 and distance("B1", "B1") == 0


def test_llm_estimator_uses_model_answer():
    class R:
        content = "B2."

    class LLM:
        def invoke(self, p):
            assert "Transcript" in p
            return R()

    assert llm_estimator(LLM())("some text") == "B2"


def test_transcript_set_is_balanced():
    rows = json.loads((Path(__file__).parents[1] / "evals/cefr/transcripts.json").read_text())
    levels = [r["level"] for r in rows]
    assert {lv: levels.count(lv) for lv in set(levels)} == {"A2": 6, "B1": 6, "B2": 6, "C1": 6}
