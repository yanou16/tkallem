"""Improvement 4 in the report: its first line is the progress since the student's last finished session, written by
code from the stored metrics. No network: the model is a FakeChat."""
from contextlib import nullcontext

import pytest
from fastapi.testclient import TestClient

from app.db.connection import get_conn, get_conn_factory
from app.db.users import get_or_create_by_clerk_id, update_profile
from app.main import app
from app.routes.sessions import get_llm
from app.security import ClerkClaims, get_clerk_claims
from tkallem_agent.testing import FakeChat

CLERK_ID = "user_progress_test"
FIX = {"original": "for study", "fixed": "to study", "type": "grammar", "why": "Le but : to + verbe."}


@pytest.fixture
def client(db):
    app.dependency_overrides[get_clerk_claims] = lambda: ClerkClaims(user_id=CLERK_ID, session_id=None)
    app.dependency_overrides[get_conn] = lambda: db
    app.dependency_overrides[get_conn_factory] = lambda: (lambda: nullcontext(db))
    user = get_or_create_by_clerk_id(db, CLERK_ID)
    update_profile(db, user["id"], {"level": "B1"})
    yield TestClient(app)
    app.dependency_overrides.clear()


def interview(client, answer, found):
    app.dependency_overrides[get_llm] = lambda: FakeChat([found], [{"reaction": "Good.", "goal_covered": "purpose_of_trip"}], text=["Note."])
    sid = client.post("/sessions", json={"scenario_id": "visa-us", "mode": "text"}).json()["session_id"]
    assert client.post(f"/sessions/{sid}/turn", data={"text": answer}).status_code == 200
    report = client.post(f"/sessions/{sid}/end")
    assert report.status_code == 200
    return sid, report.json()


def test_the_report_opens_with_progress_since_the_last_interview(client):
    sid1, first = interview(client, "I go to the US for study.", {"corrections": [FIX]})
    assert first["progress"] == "First interview done: this is your starting point."
    sid2, second = interview(client, "I go to the US to study computer science.", {"corrections": []})
    assert second["progress"].startswith("Fewer mistakes than last time: 0 per 100 words, down from ")
    # a reloaded finished session shows the same first line
    assert client.get(f"/sessions/{sid2}").json()["progress"] == second["progress"]
    assert client.get(f"/sessions/{sid1}").json()["progress"] == first["progress"]
