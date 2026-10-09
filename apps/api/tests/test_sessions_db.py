from uuid import uuid4

import pytest

from app.db.sessions import create_session, end_session, get_session_for_user, save_turn
from app.db.users import get_or_create_by_clerk_id

STATE = {"turns": [], "level": "B1"}

METRICS = {
    "words": 42,
    "mistakes_per_100": 7.1,
    "words_per_answer": 14.0,
    "hesitations_per_min": None,
    "speaking_seconds": None,
}


@pytest.fixture
def user(db):
    return get_or_create_by_clerk_id(db, "user_sessions_test")


@pytest.fixture
def session_id(db, user):
    sid = uuid4()
    create_session(db, sid, user["id"], "visa-us", "text", "fr", STATE)
    return sid


def test_created_session_can_be_read_back(db, user, session_id):
    session = get_session_for_user(db, session_id, user["id"])

    assert session["scenario_id"] == "visa-us"
    assert session["state"] == STATE
    assert session["ended_at"] is None


def test_other_user_cannot_read_the_session(db, session_id):
    other = get_or_create_by_clerk_id(db, "user_someone_else")

    assert get_session_for_user(db, session_id, other["id"]) is None


def test_save_turn_numbers_turns_and_stores_corrections(db, user, session_id):
    correction = {"original": "I go", "fixed": "I'm going", "type": "grammar", "why": "Projet futur."}

    save_turn(db, session_id, {"step": 1}, "I go to the US", "Why?", "orange", None, [correction])
    second = save_turn(db, session_id, {"step": 2}, "For study.", "Good.", "green", "purpose", [])

    positions = db.execute(
        "SELECT position FROM turns WHERE session_id = %s ORDER BY position", (session_id,)
    ).fetchall()
    assert [row["position"] for row in positions] == [1, 2]

    stored = db.execute("SELECT original, fixed, type, why FROM corrections").fetchall()
    assert stored == [correction]

    assert get_session_for_user(db, session_id, user["id"])["state"] == {"step": 2}
    assert isinstance(second, int)


def test_end_session_only_once(db, user, session_id):
    assert end_session(db, session_id, "Bon travail.", METRICS) is True
    assert end_session(db, session_id, "Bon travail.", METRICS) is False

    session = get_session_for_user(db, session_id, user["id"])
    assert session["ended_at"] is not None

    metrics = db.execute(
        "SELECT words, hesitations_per_min FROM session_metrics WHERE session_id = %s", (session_id,)
    ).fetchone()
    assert metrics == {"words": 42, "hesitations_per_min": None}