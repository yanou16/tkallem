import math

import pytest

from tkallem_agent import CoachSession
from tkallem_agent.freeze import MAX_THINK_SECONDS, clean_think, freeze_compare, freeze_summary
from tkallem_agent.testing import FakeChat


@pytest.mark.parametrize("value, expected", [
    (3.14159, 3.1), (0, 0.0), (9, 9.0), (500, MAX_THINK_SECONDS), (120, 120.0),
    (-1, None), (None, None), ("4", None), (True, None), (math.nan, None), (math.inf, None),
])
def test_clean_think(value, expected):
    assert clean_think(value) == expected


def turns(*items):
    return [{"think_seconds": t, "audio_seconds": a} for t, a in items]


def test_summary_averages_and_tells_voice_from_text():
    assert freeze_summary(turns((9, 2.0), (3, 1.5))) == {"seconds": 6.0, "answers": 2, "kind": "voice"}
    assert freeze_summary(turns((4, None), (6, None))) == {"seconds": 5.0, "answers": 2, "kind": "text"}
    assert freeze_summary(turns((4, None), (6, 2.0)))["kind"] == "mixed"


def test_summary_ignores_unmeasured_answers_and_old_sessions():
    assert freeze_summary(turns((8, 2.0), (None, 2.0), (-3, 2.0)))["answers"] == 1
    assert freeze_summary([{"audio_seconds": 2.0}]) is None
    assert freeze_summary([]) is None


def test_compare_only_comparable_sessions():
    voice9 = {"seconds": 9.0, "answers": 4, "kind": "voice"}
    voice3 = {"seconds": 3.0, "answers": 4, "kind": "voice"}
    text5 = {"seconds": 5.0, "answers": 4, "kind": "text"}
    mixed = {"seconds": 5.0, "answers": 4, "kind": "mixed"}
    assert freeze_compare(voice3, voice9)["previous"] == 9.0
    assert freeze_compare(voice3, text5)["previous"] is None  # a typed session says nothing about a spoken one
    assert freeze_compare(mixed, mixed)["previous"] is None
    assert freeze_compare(voice3, None)["previous"] is None
    assert freeze_compare(None, voice9) is None


def test_the_session_keeps_a_cleaned_measure_for_each_answer():
    llm = FakeChat(found=[{"corrections": []}] * 3, replies=[{"reaction": "Good.", "goal_covered": None}] * 3)
    s = CoachSession("visa-us", "B1", llm=llm)
    s.turn("I go to the US to study.", think_seconds=7.26)
    s.turn("I study computer science.", audio_seconds=2.0, think_seconds=900)
    s.turn("My father pays.")
    state = s.to_state()["turns"]
    assert [t["think_seconds"] for t in state] == [7.3, 120.0, None]
    assert freeze_summary(state) == {"seconds": 63.6, "answers": 2, "kind": "mixed"}
