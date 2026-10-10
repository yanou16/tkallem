import pytest
from pydantic import ValidationError

from tkallem_agent.scenarios import SCENARIOS_DIR, Scenario, list_scenarios, read_scenario

BASE = {
    "id": "x", "title": "X", "coach_role": "r",
    "description": "A short sentence about the scenario.", "category": "travel", "level": "B1", "icon": "plane", "minutes": 5,
}


def test_all_scenario_files_are_valid():
    files = sorted(SCENARIOS_DIR.glob("*.json"))
    for f in files:
        read_scenario(f)  # strict: raises on the first broken file
    ids = [s.id for s in list_scenarios()]
    assert len(ids) == len(files)
    assert {"visa-us", "campus-france", "job-remote", "ielts-part2", "free-talk"} <= set(ids)
    assert len(ids) == len(set(ids))
    for s in list_scenarios():
        if s.mode == "guided":
            assert len(s.questions) == 6 and s.minutes
        assert s.first_line


def test_guided_needs_one_goal_per_question():
    with pytest.raises(ValidationError):
        Scenario(**BASE, questions=["q1", "q2"], goals=["g1"])
    with pytest.raises(ValidationError):
        Scenario(**BASE, questions=["q1", "q2"], goals=["g", "g"])


def test_free_needs_an_opening_and_no_questions():
    with pytest.raises(ValidationError):
        Scenario(**BASE, mode="free")
    with pytest.raises(ValidationError):
        Scenario(**BASE, mode="free", opening="Hi!", questions=["q"])
    assert Scenario(**BASE, mode="free", opening="Hi!").first_line == "Hi!"


def test_a_broken_file_does_not_hide_the_others(tmp_path, monkeypatch):
    import json

    from tkallem_agent import scenarios

    (tmp_path / "good.json").write_text(json.dumps({**BASE, "id": "good", "questions": ["q"], "goals": ["g"]}))
    (tmp_path / "bad.json").write_text(json.dumps({**BASE, "id": "bad", "questions": ["q1", "q2"], "goals": ["g"]}))
    monkeypatch.setattr(scenarios, "SCENARIOS_DIR", tmp_path)
    scenarios.list_scenarios.cache_clear()
    try:
        assert [s.id for s in scenarios.list_scenarios()] == ["good"]
    finally:
        scenarios.list_scenarios.cache_clear()


def test_card_fields_are_required_and_validated():
    for field in ("description", "category", "level", "icon", "minutes"):
        with pytest.raises(ValidationError):
            Scenario(**{k: v for k, v in BASE.items() if k != field}, questions=["q"], goals=["g"])
    bad = {"category": "cooking", "level": "C2", "icon": "Plane 2", "minutes": 0, "description": "too short"}
    for field, value in bad.items():
        with pytest.raises(ValidationError):
            Scenario(**{**BASE, field: value}, questions=["q"], goals=["g"])


def test_shipped_cards_are_ready_for_the_front():
    cards = list_scenarios()
    assert [s.id for s in cards] == sorted(s.id for s in cards)  # sorted by id
    for s in cards:
        assert s.minutes > 0 and s.level in {"A2", "B1", "B2", "C1"} and s.description.endswith(".")
        assert s.category in {"travel", "study", "work", "exams", "speaking"} and s.icon.isalpha()
