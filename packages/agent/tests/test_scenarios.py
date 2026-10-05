import pytest
from pydantic import ValidationError

from tkallem_agent.scenarios import Scenario, list_scenarios

BASE = {"id": "x", "title": "X", "coach_role": "r"}


def test_all_scenario_files_are_valid():
    ids = [s.id for s in list_scenarios()]
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
