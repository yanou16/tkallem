"""Freeze meter on the session routes: the app sends `think_seconds` with each answer, the report shows the average and
the previous finished session's when comparable. No network: the model is a FakeChat."""
from contextlib import nullcontext

import pytest
from fastapi.testclient import TestClient

from app.db.connection import get_conn, get_conn_factory
from app.db.users import get_or_create_by_clerk_id, update_profile
from app.main import app
from app.routes.sessions import get_llm
from app.security import ClerkClaims, get_clerk_claims
from tkallem_agent.testing import FakeChat

CLERK_ID = "user_freeze_test"


@pytest.fixture
def client(db):
    app.dependency_overrides[get_clerk_claims] = lambda: ClerkClaims(user_id=CLERK_ID, session_id=None)
    app.dependency_overrides[get_conn] = lambda: db
    app.dependency_overrides[get_conn_factory] = lambda: (lambda: nullcontext(db))
    user = get_or_create_by_clerk_id(db, CLERK_ID)
    update_profile(db, user["id"], {"level": "B1"})
    yield TestClient(app)
    app.dependency_overrides.clear()


def interview(client, thinks):
    n = len(thinks)
    app.dependency_overrides[get_llm] = lambda: FakeChat(
        [{"corrections": []}] * n, [{"reaction": "Good.", "goal_covered": None}] * n, text=["Note."])
    sid = client.post("/sessions", json={"scenario_id": "visa-us", "mode": "text"}).json()["session_id"]
    for t in thinks:
        data = {"text": "I go to the US to study."}
        if t is not None:
            data["think_seconds"] = str(t)
        assert client.post(f"/sessions/{sid}/turn", data=data).status_code == 200
    report = client.post(f"/sessions/{sid}/end")
    assert report.status_code == 200
    return sid, report.json()


def test_the_report_shows_the_wait_and_the_previous_one(client, db):
    sid1, first = interview(client, [12, 6])
    assert first["freeze"] == {"seconds": 9.0, "answers": 2, "kind": "text", "previous": None}
    db.execute("UPDATE practice_sessions SET ended_at = ended_at - interval '1 hour' WHERE id = %s", (sid1,))
    sid2, second = interview(client, [4, 2])
    assert second["freeze"] == {"seconds": 3.0, "answers": 2, "kind": "text", "previous": 9.0}
    assert client.get(f"/sessions/{sid2}").json()["freeze"] == second["freeze"]


def test_bad_or_missing_measures_are_ignored_and_never_an_error(client, db):
    _, report = interview(client, [None])
    assert report["freeze"] is None
    app.dependency_overrides[get_llm] = lambda: FakeChat([{"corrections": []}], [{"reaction": "Good.", "goal_covered": None}])
    sid = client.post("/sessions", json={"scenario_id": "visa-us", "mode": "text"}).json()["session_id"]
    r = client.post(f"/sessions/{sid}/turn", data={"text": "I go to the US to study.", "think_seconds": "soon"})
    assert r.status_code == 200
    assert client.get(f"/sessions/{sid}").json()["freeze"] is None  # not finished yet


def test_a_huge_measure_is_capped_at_two_minutes(client, db):
    _, report = interview(client, [900])
    assert report["freeze"]["seconds"] == 120.0
