from contextlib import nullcontext
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from tkallem_agent.scenarios import load_scenario

from app.db.connection import get_conn, get_conn_factory
from app.db.sessions import create_session
from app.db.users import get_or_create_by_clerk_id, update_profile
from app.main import app
from app.routes.sessions import get_llm
from app.security import ClerkClaims, get_clerk_claims
from tests.fake_llm import FakeChat

CLERK_ID = "user_turn_test"
STUDENT = "I go to the US for study."

FOUND = {"corrections": [{"original": "for study", "fixed": "to study", "type": "grammar", "why": "Le but : to + verbe."}]}
NONE = {"corrections": []}


def reply(text="Good."):
    return {"reaction": text, "goal_covered": None}


def use_llm(fake):
    app.dependency_overrides[get_llm] = lambda: fake


@pytest.fixture
def client(db):
    app.dependency_overrides[get_clerk_claims] = lambda: ClerkClaims(user_id=CLERK_ID, session_id=None)
    app.dependency_overrides[get_conn] = lambda: db
    app.dependency_overrides[get_conn_factory] = lambda: (lambda: nullcontext(db))
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def session_id(client, db):
    user = get_or_create_by_clerk_id(db, CLERK_ID)
    update_profile(db, user["id"], {"level": "B1"})
    return client.post("/sessions", json={"scenario_id": "visa-us"}).json()["session_id"]


def send(client, session_id, text=STUDENT):
    return client.post(f"/sessions/{session_id}/turn", data={"text": text})


def test_turn_returns_coach_reply_and_saves_it(client, db, session_id):
    use_llm(FakeChat([FOUND], [reply()]))

    response = send(client, session_id)

    assert response.status_code == 200
    body = response.json()
    assert body["transcript"] == STUDENT
    assert body["reply"].startswith("Good.")
    assert body["sentence_status"] == "orange"
    assert body["corrections"][0]["fixed"] == "to study"
    assert body["finished"] is False

    turns = db.execute(
        "SELECT position, sentence_status FROM turns WHERE session_id = %s", (UUID(session_id),)
    ).fetchall()
    assert turns == [{"position": 1, "sentence_status": "orange"}]
    state = db.execute("SELECT state FROM practice_sessions WHERE id = %s", (UUID(session_id),)).fetchone()["state"]
    assert len(state["turns"]) == 1


def test_agent_failure_returns_502_and_saves_nothing(client, db, session_id):
    use_llm(FakeChat([NONE], [RuntimeError("provider down")]))

    assert send(client, session_id).status_code == 502
    assert db.execute("SELECT count(*) AS n FROM turns").fetchone()["n"] == 0


def test_empty_answer_returns_422(client, session_id):
    use_llm(FakeChat())

    assert send(client, session_id, text="   ").status_code == 422


def test_ended_session_returns_409(client, db, session_id):
    db.execute("UPDATE practice_sessions SET ended_at = now() WHERE id = %s", (UUID(session_id),))
    use_llm(FakeChat())

    assert send(client, session_id).status_code == 409


def test_unknown_session_returns_404(client):
    use_llm(FakeChat())

    assert send(client, uuid4().hex).status_code == 404


def test_someone_elses_session_returns_404(client, db):
    other = get_or_create_by_clerk_id(db, "user_other_student")
    sid = uuid4()
    create_session(db, sid, other["id"], "visa-us", "text", "fr", {"turns": []})
    use_llm(FakeChat())

    assert send(client, sid.hex).status_code == 404


def test_invalid_session_id_returns_422(client):
    assert send(client, "not-a-uuid").status_code == 422


def test_turn_requires_a_token():
    assert send(TestClient(app), uuid4().hex).status_code == 401


def end(client, session_id):
    return client.post(f"/sessions/{session_id}/end")


def test_end_returns_report_and_saves_metrics(client, db, session_id):
    use_llm(FakeChat([FOUND], [reply()], text=["Honest note."]))
    send(client, session_id)

    response = end(client, session_id)

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"lines", "note", "metrics", "levels", "redo_index"}
    assert body["levels"] == {"mistakes_per_100": "red", "words_per_answer": "orange", "hesitations_per_min": None}
    assert body["lines"][body["redo_index"]]["role"] == "student"
    assert body["note"]
    assert "words" not in body["metrics"]
    assert body["metrics"]["mistakes_per_100"] == pytest.approx(14.3)
    student_lines = [line for line in body["lines"] if line["role"] == "student"]
    assert student_lines[0]["status"] == "orange"

    saved = db.execute(
        "SELECT words, mistakes_per_100 FROM session_metrics WHERE session_id = %s", (UUID(session_id),)
    ).fetchone()
    assert saved["words"] == 7
    assert saved["mistakes_per_100"] == pytest.approx(14.3)
    ended_at = db.execute(
        "SELECT ended_at FROM practice_sessions WHERE id = %s", (UUID(session_id),)
    ).fetchone()["ended_at"]
    assert ended_at is not None


def test_end_without_any_answer_returns_409(client, session_id):
    use_llm(FakeChat())

    assert end(client, session_id).status_code == 409


def test_end_twice_returns_409(client, session_id):
    use_llm(FakeChat([NONE], [reply()], text=["Good."]))
    send(client, session_id, text="I want to study in Boston.")

    assert end(client, session_id).status_code == 200
    assert end(client, session_id).status_code == 409


def test_end_unknown_session_returns_404(client):
    use_llm(FakeChat())

    assert end(client, uuid4().hex).status_code == 404


def test_turn_is_finished_after_the_last_question(client, session_id):
    questions = len(load_scenario("visa-us").questions)
    use_llm(FakeChat([NONE] * questions, [reply()] * questions))

    responses = [send(client, session_id, text="My answer is fine.") for _ in range(questions)]

    assert [r.json()["finished"] for r in responses] == [False] * (questions - 1) + [True]