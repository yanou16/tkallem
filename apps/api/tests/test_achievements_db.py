from uuid import uuid4

import pytest

from app.db.achievements import get_achievement_facts
from app.db.sessions import create_session, end_session
from app.db.users import get_or_create_by_clerk_id

STATE = {"turns": [], "level": "B1"}
METRICS = {
    "words": 40,
    "mistakes_per_100": 5.0,
    "words_per_answer": 8.0,
    "hesitations_per_min": None,
    "speaking_seconds": None,
}


@pytest.fixture
def user(db):
    return get_or_create_by_clerk_id(db, "user_achievements_test")


def add_session(db, user_id: int, days_back: int = 0, speaking_seconds: float | None = None, finished: bool = True):
    sid = uuid4()
    create_session(db, sid, user_id, "visa-us", "text", "fr", STATE)
    db.execute(
        "UPDATE practice_sessions SET started_at = now() - make_interval(days => %s) WHERE id = %s",
        (days_back, sid),
    )
    if finished:
        end_session(db, sid, "Good work.", {**METRICS, "speaking_seconds": speaking_seconds})
    return sid


def test_facts_for_a_new_user(db, user):
    assert get_achievement_facts(db, user["id"]) == {"finished_sessions": 0, "voice_sessions": 0, "best_streak": 0}


def test_counts_finished_and_spoken_sessions(db, user):
    add_session(db, user["id"])
    add_session(db, user["id"])
    add_session(db, user["id"], speaking_seconds=95)
    add_session(db, user["id"], finished=False)

    facts = get_achievement_facts(db, user["id"])

    assert facts["finished_sessions"] == 3
    assert facts["voice_sessions"] == 1


def test_best_streak_includes_an_old_run(db, user):
    for days_back in (12, 11, 10, 0):
        add_session(db, user["id"], days_back=days_back, finished=False)

    assert get_achievement_facts(db, user["id"])["best_streak"] == 3


def test_facts_ignore_other_users(db, user):
    other = get_or_create_by_clerk_id(db, "user_achievements_other")
    add_session(db, other["id"], speaking_seconds=60)

    assert get_achievement_facts(db, user["id"]) == {"finished_sessions": 0, "voice_sessions": 0, "best_streak": 0}
