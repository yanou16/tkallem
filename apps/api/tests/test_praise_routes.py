"""Improvement 4 on the session routes: the praise and the priority correction come with the answer (JSON and stream)
and come back when the session is reloaded. No network: the model is a FakeChat."""
import json
from contextlib import nullcontext

import pytest
from fastapi.testclient import TestClient

from app.db.connection import get_conn, get_conn_factory
from app.db.users import get_or_create_by_clerk_id, update_profile
from app.main import app
from app.routes.sessions import get_llm
from app.security import ClerkClaims, get_clerk_claims
from tkallem_agent.testing import FakeChat

CLERK_ID = "user_praise_test"
GO = {"original": "I go", "fixed": "I went", "type": "grammar", "why": "Passé : went."}
HAVE = {"original": "he have", "fixed": "he has", "type": "grammar", "why": "He : has."}
TEXT = "Yesterday I go to the embassy and he have my papers."


@pytest.fixture
def client(db):
    app.dependency_overrides[get_clerk_claims] = lambda: ClerkClaims(user_id=CLERK_ID, session_id=None)
    app.dependency_overrides[get_conn] = lambda: db
    app.dependency_overrides[get_conn_factory] = lambda: (lambda: nullcontext(db))
    yield TestClient(app)
    app.dependency_overrides.clear()


def start(client, db, found):
    app.dependency_overrides[get_llm] = lambda: FakeChat([found], [{"reaction": "Good.", "goal_covered": "purpose_of_trip"}])
    user = get_or_create_by_clerk_id(db, CLERK_ID)
    update_profile(db, user["id"], {"level": "B1"})
    return client.post("/sessions", json={"scenario_id": "visa-us", "mode": "text"}).json()["session_id"]


def test_praise_and_priority_come_with_the_answer_and_after_a_reload(client, db):
    sid = start(client, db, {"corrections": [GO, HAVE], "praise": "Good detail: 'the embassy'.", "priority_index": 1})
    body = client.post(f"/sessions/{sid}/turn", data={"text": TEXT}).json()
    assert body["praise"] == "Good detail: 'the embassy'." and body["priority_index"] == 1
    turn = client.get(f"/sessions/{sid}").json()["turns"][0]
    assert turn["praise"] == "Good detail: 'the embassy'." and turn["priority_index"] == 1


def test_an_invented_praise_is_not_sent(client, db):
    sid = start(client, db, {"corrections": [GO], "praise": "Great detail about your trip to Paris.", "priority_index": 0})
    body = client.post(f"/sessions/{sid}/turn", data={"text": TEXT}).json()
    assert body["praise"] is None and body["priority_index"] == 0
    assert client.get(f"/sessions/{sid}").json()["turns"][0]["praise"] is None


def test_the_stream_carries_the_praise_with_the_corrections(client, db):
    sid = start(client, db, {"corrections": [GO], "praise": "Good detail: 'the embassy'."})
    r = client.post(f"/sessions/{sid}/turn", headers={"Accept": "text/event-stream"}, data={"text": TEXT})
    events = {}
    for block in r.text.strip().split("\n\n"):
        lines = dict(line.split(": ", 1) for line in block.splitlines() if ": " in line)
        events[lines["event"]] = json.loads(lines["data"])
    assert events["corrections"]["praise"] == "Good detail: 'the embassy'."
    assert events["corrections"]["priority_index"] == 0
    assert events["done"]["praise"] == "Good detail: 'the embassy'."
