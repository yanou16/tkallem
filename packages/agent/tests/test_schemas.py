import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from tkallem_agent.graph import build_system_prompt
from tkallem_agent.schemas import AgentTurn

C = {"original": "for study", "fixed": "to study", "type": "grammar", "why": "Le but : to + verbe."}


def test_valid_turn():
    t = AgentTurn(reply="Good.", corrections=[C], sentence_status="orange", goal_covered="purpose_of_trip")
    assert t.corrections[0].fixed == "to study"


def test_clean_sentence_is_green():
    AgentTurn(reply="Good.", corrections=[], sentence_status="green")
    with pytest.raises(ValidationError):
        AgentTurn(reply="Good.", corrections=[], sentence_status="orange")


def test_more_than_3_corrections_rejected():
    with pytest.raises(ValidationError):
        AgentTurn(reply="x", corrections=[C] * 4, sentence_status="red")


def test_noop_correction_rejected():
    with pytest.raises(ValidationError):
        AgentTurn(reply="x", corrections=[{**C, "fixed": "For study"}], sentence_status="orange")


def test_three_corrections_is_red():
    with pytest.raises(ValidationError):
        AgentTurn(reply="x", corrections=[C] * 3, sentence_status="orange")


def test_eval_set_integrity():
    rows = json.loads((Path(__file__).parents[1] / "evals/correction_set.json").read_text())
    assert len(rows) == 30
    assert len({r["id"] for r in rows}) == 30
    assert all(r["level"] in {"A2", "B1", "B2", "C1"} for r in rows)
    assert all(e["wrong"] != e["fixed"] for r in rows for e in r["errors"])


def test_system_prompt_contains_level_and_questions():
    from tkallem_agent.scenarios import load_scenario

    scenario = load_scenario("visa-us").model_dump()
    p = build_system_prompt("B1", scenario)
    assert "B1" in p and "What is the purpose of your trip?" in p and "max 12 words" in p


def test_sanitize_drops_noop_and_derives_status():
    from tkallem_agent.schemas import sanitize

    raw = {
        "reply": "ok",
        "corrections": [{**C, "original": "students", "fixed": "students"}],
        "sentence_status": "orange",
        "goal_covered": None,
    }
    out = AgentTurn.model_validate(sanitize(raw))
    assert out.corrections == [] and out.sentence_status == "green"


def test_sanitize_caps_at_three_and_marks_red():
    from tkallem_agent.schemas import sanitize

    raw = {"reply": "ok", "corrections": [C] * 5, "sentence_status": "orange", "goal_covered": None}
    out = AgentTurn.model_validate(sanitize(raw))
    assert len(out.corrections) == 3 and out.sentence_status == "red"


def test_sanitize_blocks_meaning_changes_and_rewrites():
    from tkallem_agent.schemas import sanitize

    base = {"reply": "ok", "sentence_status": "orange", "goal_covered": None}
    text = "I would like to study in Germany. I can pay my studies."
    cases = [
        {**C, "original": "in Germany", "fixed": "in the USA"},  # drops a proper noun
        {**C, "original": "in Mars", "fixed": "on Mars"},  # fragment not in the student's text
        {**C, "original": "pay my studies", "fixed": "pay for my studies with my savings and my family help"},  # rewrites
    ]
    for c in cases:
        assert sanitize({**base, "corrections": [c]}, None, text)["corrections"] == []
    ok = {**C, "original": "pay my studies", "fixed": "pay for my studies"}
    assert len(sanitize({**base, "corrections": [ok]}, None, text)["corrections"]) == 1
