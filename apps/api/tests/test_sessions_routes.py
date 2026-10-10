from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.db.connection import get_conn
from app.db.sessions import get_session_for_user
from app.db.users import get_or_create_by_clerk_id, update_profile
from app.main import app
from app.security import ClerkClaims, get_clerk_claims

CLERK_ID = "user_sessions_route_test"


@pytest.fixture
def client(db):
    app.dependency_overrides[get_clerk_claims] = lambda: ClerkClaims(user_id=CLERK_ID, session_id=None)
    app.dependency_overrides[get_conn] = lambda: db
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def user_b1(db):
    user = get_or_create_by_clerk_id(db, CLERK_ID)
    return update_profile(db, user["id"], {"level": "B1"})


def test_start_session_requires_a_level(client):
    response = client.post("/sessions", json={"scenario_id": "visa-us"})

    assert response.status_code == 409


def test_start_session_returns_first_question_and_saves_it(client, db, user_b1):
    response = client.post("/sessions", json={"scenario_id": "visa-us"})

    assert response.status_code == 200
    body = response.json()
    assert body["first_question"]["text"]
    assert body["first_question"]["audio_url"] is None

    saved = get_session_for_user(db, UUID(body["session_id"]), user_b1["id"])
    assert saved["scenario_id"] == "visa-us"
    assert saved["mode"] == "text"
    assert saved["explain_lang"] == "fr"
    assert saved["state"]["level"] == "B1"
    assert saved["state"]["turns"] == []


def test_explain_lang_from_request_wins(client, db, user_b1):
    response = client.post("/sessions", json={"scenario_id": "visa-us", "explain_lang": "en"})

    saved = get_session_for_user(db, UUID(response.json()["session_id"]), user_b1["id"])
    assert saved["explain_lang"] == "en"


def test_unknown_scenario_returns_404(client, user_b1):
    assert client.post("/sessions", json={"scenario_id": "visa-mars"}).status_code == 404


def test_invalid_mode_returns_422(client, user_b1):
    assert client.post("/sessions", json={"scenario_id": "visa-us", "mode": "video"}).status_code == 422


def test_start_session_requires_a_token():
    assert TestClient(app).post("/sessions", json={"scenario_id": "visa-us"}).status_code == 401