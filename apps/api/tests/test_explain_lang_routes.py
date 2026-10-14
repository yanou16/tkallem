"""Explain in English / French: the language can change from one answer to the next, and the report's note can be
written again in the other language."""
from contextlib import nullcontext
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from app import rate_limit
from app.db.connection import get_conn, get_conn_factory
from app.db.users import get_or_create_by_clerk_id, update_profile
from app.main import app
from app.routes.sessions import get_llm
from app.security import ClerkClaims, get_clerk_claims
from tkallem_agent.testing import FakeChat

CLERK_ID = "user_explain_lang_test"


@pytest.fixture
def client(db):
    app.dependency_overrides[get_clerk_claims] = lambda: ClerkClaims(user_id=CLERK_ID, session_id=None)
    app.dependency_overrides[get_conn] = lambda: db
    app.dependency_overrides[get_conn_factory] = lambda: (lambda: nullcontext(db))
    app.dependency_overrides[get_llm] = lambda: FakeChat(
        [{"corrections": []}] * 3, [{"reaction": "Good.", "goal_covered": None}] * 3, text=["Note."] * 12)
    user = get_or_create_by_clerk_id(db, CLERK_ID)
    update_profile(db, user["id"], {"level": "B1"})
    rate_limit.explain_notes.reset()
    yield TestClient(app)
    app.dependency_overrides.clear()
    rate_limit.explain_notes.reset()


def new_session(client, **body):
    return client.post("/sessions", json={"scenario_id": "visa-us", **body}).json()["session_id"]


def saved_lang(db, sid):
    return db.execute("SELECT state FROM practice_sessions WHERE id = %s", (UUID(sid),)).fetchone()["state"]["explain_lang"]


def test_an_answer_can_switch_the_language_and_it_stays(client, db):
    sid = new_session(client, explain_lang="fr")
    assert saved_lang(db, sid) == "fr"
    assert client.post(f"/sessions/{sid}/turn", data={"text": "I go to the US to study.", "explain_lang": "en"}).status_code == 200
    assert saved_lang(db, sid) == "en"
    client.post(f"/sessions/{sid}/turn", data={"text": "I will study computer science."})  # no field: the choice is kept
    assert saved_lang(db, sid) == "en"


def test_an_unknown_language_is_ignored_not_an_error(client, db):
    sid = new_session(client, explain_lang="fr")
    assert client.post(f"/sessions/{sid}/turn", data={"text": "I go to the US to study.", "explain_lang": "ar"}).status_code == 200
    assert saved_lang(db, sid) == "fr"


def test_the_note_is_written_again_in_the_other_language(client):
    sid = new_session(client, explain_lang="fr")
    client.post(f"/sessions/{sid}/turn", data={"text": "I go to the US to study."})
    r = client.post(f"/sessions/{sid}/note", json={"lang": "en"})
    assert r.status_code == 200
    assert r.json() == {"note": "Note.", "explain_lang": "en"}


def test_the_note_needs_an_answer_a_known_language_and_an_owned_session(client):
    sid = new_session(client)
    assert client.post(f"/sessions/{sid}/note", json={"lang": "en"}).status_code == 409  # no answer yet
    client.post(f"/sessions/{sid}/turn", data={"text": "I go to the US to study."})
    assert client.post(f"/sessions/{sid}/note", json={"lang": "ar"}).status_code == 422
    assert client.post(f"/sessions/{sid}/note", json={"lang": "en", "extra": 1}).status_code == 422
    assert client.post(f"/sessions/{uuid4()}/note", json={"lang": "en"}).status_code == 404


def test_the_note_is_limited_to_ten_an_hour(client):
    sid = new_session(client)
    client.post(f"/sessions/{sid}/turn", data={"text": "I go to the US to study."})
    codes = [client.post(f"/sessions/{sid}/note", json={"lang": "en"}).status_code for _ in range(11)]
    assert codes == [200] * 10 + [429]


def test_the_note_route_asks_for_a_token():
    app.dependency_overrides.clear()
    assert TestClient(app).post(f"/sessions/{uuid4()}/note", json={"lang": "en"}).status_code == 401
