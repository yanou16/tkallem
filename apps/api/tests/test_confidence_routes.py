"""The student's own 1-to-5 confidence, before and after a session (the numbers behind the impact line of the pitch)."""
from contextlib import nullcontext

import pytest
from fastapi.testclient import TestClient

from app.db.connection import get_conn, get_conn_factory
from app.db.sessions import confidence_summary
from app.db.users import get_or_create_by_clerk_id, update_profile
from app.main import app
from app.routes.sessions import get_llm
from app.security import ClerkClaims, get_clerk_claims
from tkallem_agent.testing import FakeChat

CLERK_ID = "user_confidence_test"


@pytest.fixture
def client(db):
    app.dependency_overrides[get_clerk_claims] = lambda: ClerkClaims(user_id=CLERK_ID, session_id=None)
    app.dependency_overrides[get_conn] = lambda: db
    app.dependency_overrides[get_conn_factory] = lambda: (lambda: nullcontext(db))
    app.dependency_overrides[get_llm] = lambda: FakeChat(
        [{"corrections": []}] * 3, [{"reaction": "Good.", "goal_covered": None}] * 3, text=["Note."] * 3)
    user = get_or_create_by_clerk_id(db, CLERK_ID)
    update_profile(db, user["id"], {"level": "B1"})
    yield TestClient(app)
    app.dependency_overrides.clear()


def new_session(client):
    return client.post("/sessions", json={"scenario_id": "visa-us"}).json()["session_id"]


def ask(client, sid, when, value):
    return client.post(f"/sessions/{sid}/confidence", json={"when": when, "value": value})


def test_before_and_after_come_back_in_the_report_and_the_reload(client, db):
    base = confidence_summary(db)["sessions"]
    sid = new_session(client)
    assert ask(client, sid, "before", 2).status_code == 204
    assert client.get(f"/sessions/{sid}").json()["confidence"] == {"before": 2, "after": None}
    client.post(f"/sessions/{sid}/turn", data={"text": "I go to the US to study."})
    report = client.post(f"/sessions/{sid}/end").json()
    assert report["confidence"] == {"before": 2, "after": None}
    assert ask(client, sid, "after", 4).status_code == 204
    assert client.get(f"/sessions/{sid}").json()["confidence"] == {"before": 2, "after": 4}
    summary = confidence_summary(db)
    assert summary["sessions"] == base + 1


def test_an_answer_can_be_changed_and_stays_between_one_and_five(client):
    sid = new_session(client)
    assert ask(client, sid, "before", 1).status_code == 204
    assert ask(client, sid, "before", 3).status_code == 204
    assert client.get(f"/sessions/{sid}").json()["confidence"]["before"] == 3
    assert ask(client, sid, "before", 0).status_code == 422
    assert ask(client, sid, "before", 6).status_code == 422
    assert ask(client, sid, "someday", 3).status_code == 422


def test_before_closes_with_the_first_answer_and_after_opens_with_the_report(client):
    sid = new_session(client)
    assert ask(client, sid, "after", 4).status_code == 409  # no report yet
    client.post(f"/sessions/{sid}/turn", data={"text": "I go to the US to study."})
    assert ask(client, sid, "before", 2).status_code == 409  # too late: it would not be a "before"
    client.post(f"/sessions/{sid}/end")
    assert ask(client, sid, "after", 4).status_code == 204


def test_only_the_owner_can_answer(client):
    sid = new_session(client)
    app.dependency_overrides[get_clerk_claims] = lambda: ClerkClaims(user_id="user_other_confidence", session_id=None)
    assert ask(client, sid, "before", 3).status_code == 404


def test_the_summary_counts_only_sessions_with_both_answers(client, db):
    start = confidence_summary(db)
    a, b = new_session(client), new_session(client)
    ask(client, a, "before", 2)
    ask(client, b, "before", 5)
    client.post(f"/sessions/{a}/turn", data={"text": "I go to the US to study."})
    client.post(f"/sessions/{a}/end")
    ask(client, a, "after", 4)
    now = confidence_summary(db)
    assert now["sessions"] == start["sessions"] + 1  # b has no "after"
