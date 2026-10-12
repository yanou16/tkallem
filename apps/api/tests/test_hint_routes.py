""""Help me start" on the session routes (POST /sessions/{id}/hint). No network: the model is a FakeChat."""
from contextlib import nullcontext

import pytest
from fastapi.testclient import TestClient

from app.db.connection import get_conn, get_conn_factory
from app.db.users import get_or_create_by_clerk_id, update_profile
from app.main import app
from app.routes import sessions as routes
from app.routes.sessions import get_llm
from app.security import ClerkClaims, get_clerk_claims
from tkallem_agent.testing import FakeChat

CLERK_ID = "user_hint_test"
STARTERS = {"starters": ["The main purpose of my trip is to", "I am going to the US to"]}


@pytest.fixture
def client(db):
    app.dependency_overrides[get_clerk_claims] = lambda: ClerkClaims(user_id=CLERK_ID, session_id=None)
    app.dependency_overrides[get_conn] = lambda: db
    app.dependency_overrides[get_conn_factory] = lambda: (lambda: nullcontext(db))
    routes._hint_calls.clear()
    routes._hint_times.clear()
    yield TestClient(app)
    app.dependency_overrides.clear()


def start(client, db, llm):
    app.dependency_overrides[get_llm] = lambda: llm
    user = get_or_create_by_clerk_id(db, CLERK_ID)
    update_profile(db, user["id"], {"level": "B1"})
    return client.post("/sessions", json={"scenario_id": "visa-us", "mode": "text"}).json()["session_id"]


def test_starter_hint_is_free_and_limited_to_two_per_question(client, db):
    sid = start(client, db, FakeChat(starters=[STARTERS, STARTERS, STARTERS]))
    before = client.get("/me/credits").json()["balance"]

    first = client.post(f"/sessions/{sid}/hint", json={"type": "starter"})
    assert first.status_code == 200
    assert first.json() == {"kind": "starter", "lines": STARTERS["starters"], "fallback": False, "remaining": 1}
    assert client.post(f"/sessions/{sid}/hint", json={"type": "starter"}).json()["remaining"] == 0
    third = client.post(f"/sessions/{sid}/hint", json={"type": "starter"})
    assert third.status_code == 429
    assert client.get("/me/credits").json()["balance"] == before  # no credit spent


def test_a_new_question_gets_new_hints(client, db):
    llm = FakeChat(found=[{"corrections": []}], replies=[{"reaction": "Good.", "goal_covered": "purpose_of_trip"}],
                   starters=[STARTERS, STARTERS, {"starters": ["I will study at", "My university is"]}])
    sid = start(client, db, llm)
    client.post(f"/sessions/{sid}/hint", json={"type": "starter"})
    client.post(f"/sessions/{sid}/hint", json={"type": "starter"})
    assert client.post(f"/sessions/{sid}/turn", data={"text": "I go to the US to study."}).status_code == 200
    again = client.post(f"/sessions/{sid}/hint", json={"type": "starter"})
    assert again.status_code == 200 and again.json()["lines"] == ["I will study at", "My university is"]


def test_translation_hint_and_its_fallback(client, db):
    llm = FakeChat(english=[{"english": "My father will pay for my studies."}, {"english": "I will stay three years."}])
    sid = start(client, db, llm)
    ok = client.post(f"/sessions/{sid}/hint", json={"type": "translate", "text": "Mon père va payer mes études"})
    assert ok.json()["kind"] == "translation" and ok.json()["lines"] == ["My father will pay for my studies."]
    refused = client.post(f"/sessions/{sid}/hint", json={"type": "translate", "text": "Je reste 3 ans"})
    assert refused.json()["kind"] == "starter" and refused.json()["fallback"] is True  # "three" for "3": refused


def test_provider_down_still_gives_a_hint(client, db):
    sid = start(client, db, FakeChat(starters=[RuntimeError("503")]))
    body = client.post(f"/sessions/{sid}/hint", json={"type": "starter"}).json()
    assert body["fallback"] is True and body["lines"] == ["The main purpose of my trip is to"]


def test_bad_requests(client, db):
    sid = start(client, db, FakeChat())
    assert client.post(f"/sessions/{sid}/hint", json={"type": "translate"}).status_code == 422
    assert client.post(f"/sessions/{sid}/hint", json={"type": "joke"}).status_code == 422
    assert client.post(f"/sessions/{sid}/hint", json={"type": "starter", "extra": 1}).status_code == 422


def test_hint_only_for_the_owner(client, db):
    sid = start(client, db, FakeChat(starters=[STARTERS]))
    app.dependency_overrides[get_clerk_claims] = lambda: ClerkClaims(user_id="user_other_hint", session_id=None)
    assert client.post(f"/sessions/{sid}/hint", json={"type": "starter"}).status_code == 404


def test_hourly_cap_per_student(client, db, monkeypatch):
    monkeypatch.setattr(routes, "HINTS_PER_HOUR", 1)
    sid = start(client, db, FakeChat(starters=[STARTERS, STARTERS]))
    assert client.post(f"/sessions/{sid}/hint", json={"type": "starter"}).status_code == 200
    assert client.post(f"/sessions/{sid}/hint", json={"type": "starter"}).status_code == 429
