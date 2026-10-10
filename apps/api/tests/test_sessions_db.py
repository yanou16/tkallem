from uuid import uuid4

import pytest

from app.db.sessions import (
    create_session,
    end_session,
    get_session_detail,
    get_session_for_user,
    list_sessions_for_user,
    list_turns,
    save_turn,
)
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

    save_turn(db, session_id, {"turns": [1]}, "I go to the US", "Why?", "orange", None, [correction], expected_turns=0)
    second = save_turn(db, session_id, {"turns": [1, 2]}, "For study.", "Good.", "green", "purpose", [], expected_turns=1)

    positions = db.execute(
        "SELECT position FROM turns WHERE session_id = %s ORDER BY position", (session_id,)
    ).fetchall()
    assert [row["position"] for row in positions] == [1, 2]

    stored = db.execute("SELECT original, fixed, type, why FROM corrections").fetchall()
    assert stored == [correction]

    assert get_session_for_user(db, session_id, user["id"])["state"] == {"turns": [1, 2]}
    assert isinstance(second, int)

def test_save_turn_rejects_a_concurrent_turn(db, session_id):
    first = save_turn(db, session_id, {"turns": [1]}, "Hello", "Hi", "green", None, [], expected_turns=0)
    duplicate = save_turn(db, session_id, {"turns": [1]}, "Hello", "Hi", "green", None, [], expected_turns=0)

    assert first is not None
    assert duplicate is None
    assert db.execute("SELECT count(*) AS n FROM turns").fetchone()["n"] == 1


def test_save_turn_rejects_an_ended_session(db, session_id):
    end_session(db, session_id, "Fin.", METRICS)

    assert save_turn(db, session_id, {"turns": [1]}, "Hi", "Hi", "green", None, [], expected_turns=0) is None

def test_end_session_only_once(db, user, session_id):
    assert end_session(db, session_id, "Bon travail.", METRICS) is True
    assert end_session(db, session_id, "Bon travail.", METRICS) is False

    session = get_session_for_user(db, session_id, user["id"])
    assert session["ended_at"] is not None

    metrics = db.execute(
        "SELECT words, hesitations_per_min FROM session_metrics WHERE session_id = %s", (session_id,)
    ).fetchone()
    assert metrics == {"words": 42, "hesitations_per_min": None}

def test_list_sessions_newest_first_with_answers(db, user):
    old, new = uuid4(), uuid4()
    create_session(db, old, user["id"], "visa-us", "text", "fr", {"turns": [1, 2]})
    create_session(db, new, user["id"], "free-talk", "text", "fr", {"turns": []})
    db.execute("UPDATE practice_sessions SET started_at = now() - interval '1 day' WHERE id = %s", (old,))
    other = get_or_create_by_clerk_id(db, "user_someone_else")
    create_session(db, uuid4(), other["id"], "visa-us", "text", "fr", {"turns": []})

    sessions = list_sessions_for_user(db, user["id"], limit=5)

    assert [(s["id"], s["answered"]) for s in sessions] == [(new, 0), (old, 2)]


def test_list_sessions_respects_limit(db, user):
    for _ in range(3):
        create_session(db, uuid4(), user["id"], "visa-us", "text", "fr", {"turns": []})

    assert len(list_sessions_for_user(db, user["id"], limit=2)) == 2


def test_session_detail_has_no_report_before_the_end(db, user, session_id):
    detail = get_session_detail(db, session_id, user["id"])

    assert detail["scenario_id"] == "visa-us"
    assert detail["ended_at"] is None
    assert detail["note"] is None
    assert detail["mistakes_per_100"] is None


def test_session_detail_has_the_note_and_metrics_after_the_end(db, user, session_id):
    end_session(db, session_id, "Bon travail.", METRICS)

    detail = get_session_detail(db, session_id, user["id"])

    assert detail["ended_at"] is not None
    assert detail["note"] == "Bon travail."
    assert detail["mistakes_per_100"] == pytest.approx(7.1)
    assert detail["hesitations_per_min"] is None


def test_other_user_cannot_read_the_session_detail(db, session_id):
    other = get_or_create_by_clerk_id(db, "user_someone_else")

    assert get_session_detail(db, session_id, other["id"]) is None


def test_list_turns_in_order_with_their_corrections(db, user, session_id):
    first = {"original": "I go", "fixed": "I'm going", "type": "grammar", "why": "Projet futur."}
    second = {"original": "for study", "fixed": "to study", "type": "grammar", "why": "Le but : to + verbe."}
    save_turn(db, session_id, {"turns": [1]}, "I go to the US for study.", "Why?", "orange", None, [first, second], expected_turns=0)
    save_turn(db, session_id, {"turns": [1, 2]}, "To study.", "Good.", "green", "purpose", [], expected_turns=1)

    assert list_turns(db, session_id, user["id"]) == [
        {"position": 1, "transcript": "I go to the US for study.", "reply": "Why?", "sentence_status": "orange",
         "corrections": [first, second]},
        {"position": 2, "transcript": "To study.", "reply": "Good.", "sentence_status": "green", "corrections": []},
    ]


def test_other_user_cannot_list_the_turns(db, session_id):
    save_turn(db, session_id, {"turns": [1]}, "Hello", "Hi", "green", None, [], expected_turns=0)
    other = get_or_create_by_clerk_id(db, "user_someone_else")

    assert list_turns(db, session_id, other["id"]) == []