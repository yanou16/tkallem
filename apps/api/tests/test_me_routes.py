from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from tkallem_agent.scenarios import load_scenario

from app.db.connection import get_conn
from app.db.sessions import create_session
from app.db.users import get_or_create_by_clerk_id
from app.main import app
from app.security import ClerkClaims, get_clerk_claims


@pytest.fixture
def client(db):
    app.dependency_overrides[get_clerk_claims] = lambda: ClerkClaims(
        user_id="user_route_test", session_id=None
    )
    app.dependency_overrides[get_conn] = lambda: db
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_get_me_creates_profile_on_first_visit(client):
    response = client.get("/me")

    assert response.status_code == 200
    assert response.json() == {"first_name": None, "level": None, "explain_lang": "fr"}


def test_patch_me_updates_level(client):
    response = client.patch("/me", json={"level": "B1"})

    assert response.status_code == 200
    assert response.json()["level"] == "B1"
    assert client.get("/me").json()["level"] == "B1"


@pytest.mark.parametrize(
    "body",
    [{}, {"clerk_user_id": "someone_else"}, {"level": "Z9"}, {"level": None}],
    ids=["empty", "forbidden_field", "invalid_level", "null_level"],
)
def test_patch_me_rejects_invalid_body(client, body):
    assert client.patch("/me", json=body).status_code == 422


def test_me_requires_a_token():
    assert TestClient(app).get("/me").status_code == 401

def test_my_sessions_empty_for_a_new_student(client):
    response = client.get("/me/sessions")

    assert response.status_code == 200
    assert response.json() == []


def test_my_sessions_summaries(client, db):
    user = get_or_create_by_clerk_id(db, "user_route_test")
    visa, free = uuid4(), uuid4()
    create_session(db, visa, user["id"], "visa-us", "text", "fr", {"turns": [1, 2, 3]})
    create_session(db, free, user["id"], "free-talk", "text", "fr", {"turns": []})
    db.execute("UPDATE practice_sessions SET started_at = now() - interval '1 hour' WHERE id = %s", (visa,))

    body = client.get("/me/sessions").json()

    assert [s["session_id"] for s in body] == [free.hex, visa.hex]
    assert body[1]["title"] == load_scenario("visa-us").title
    assert body[1]["answered"] == 3
    assert body[1]["total_questions"] == len(load_scenario("visa-us").questions)
    assert body[1]["ended_at"] is None
    assert body[0]["total_questions"] is None


@pytest.mark.parametrize("limit", [0, 21])
def test_my_sessions_rejects_invalid_limit(client, limit):
    assert client.get(f"/me/sessions?limit={limit}").status_code == 422


def add_finished_session(db, user_id: int, days_back: int, mistakes: float, speaking: float | None = None):
    sid = uuid4()
    create_session(db, sid, user_id, "visa-us", "text", "fr", {"turns": [1, 2]})
    db.execute(
        "UPDATE practice_sessions SET started_at = now() - make_interval(days => %s) WHERE id = %s",
        (days_back, sid),
    )
    db.execute(
        "INSERT INTO session_metrics (session_id, words, mistakes_per_100, speaking_seconds) VALUES (%s, 50, %s, %s)",
        (sid, mistakes, speaking),
    )
    return sid


def test_my_progress_for_a_new_student(client):
    response = client.get("/me/progress")

    assert response.status_code == 200
    assert response.json() == {
        "current": {
            "mistakes_per_100": None,
            "words_per_answer": None,
            "hesitations_per_min": None,
            "speaking_seconds": None,
        },
        "baseline": None,
        "mistakes_change": None,
        "top_mistakes": [],
        "week_speaking_seconds": 0,
        "today_speaking_seconds": 0,
        "daily_goal_seconds": 600,
        "streak_days": 0,
    }


def test_my_progress_combines_activity_metrics_and_mistakes(client, db):
    user = get_or_create_by_clerk_id(db, "user_route_test")
    for days_back in (4, 3, 2):
        add_finished_session(db, user["id"], days_back, mistakes=10)
    today = add_finished_session(db, user["id"], days_back=0, mistakes=4, speaking=120)

    turn = db.execute(
        """
        INSERT INTO turns (session_id, position, transcript, reply, sentence_status)
        VALUES (%s, 1, 'I go yesterday', 'Nice!', 'orange')
        RETURNING id
        """,
        (today,),
    ).fetchone()
    db.execute(
        "INSERT INTO corrections (turn_id, original, fixed, type, why) VALUES (%s, %s, %s, 'grammar', 'past tense')",
        (turn["id"], "I go yesterday", "I went yesterday"),
    )

    body = client.get("/me/progress").json()

    assert body["baseline"]["mistakes_per_100"] == pytest.approx(10)
    assert body["current"]["mistakes_per_100"] == pytest.approx(4)
    assert body["current"]["words_per_answer"] == pytest.approx(25)
    assert body["mistakes_change"] == pytest.approx(-6)
    assert body["top_mistakes"] == [
        {"id": "grammar", "category": "grammar", "original": "I go yesterday", "correction": "I went yesterday", "count": 1}
    ]
    assert body["week_speaking_seconds"] == pytest.approx(120)
    assert body["today_speaking_seconds"] == pytest.approx(120)
    assert body["streak_days"] == 1


def test_my_progress_requires_a_token():
    assert TestClient(app).get("/me/progress").status_code == 401