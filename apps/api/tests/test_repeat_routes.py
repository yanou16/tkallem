""""Say it again" on the session routes (POST /sessions/{id}/repeat). No network: the model is a FakeChat and the
transcription is replaced in the routes module."""
from contextlib import nullcontext

import pytest
from fastapi.testclient import TestClient

from app.db.connection import get_conn, get_conn_factory
from app.db.users import get_or_create_by_clerk_id, update_profile
from app.main import app
from app.routes import sessions as routes
from app.routes.sessions import get_llm
from app.security import ClerkClaims, get_clerk_claims
from app.voice.stt import Transcription
from tkallem_agent.testing import FakeChat

CLERK_ID = "user_repeat_test"
FIX = {"original": "for study", "fixed": "to study", "type": "grammar", "why": "Le but : to + verbe."}


@pytest.fixture
def client(db):
    app.dependency_overrides[get_clerk_claims] = lambda: ClerkClaims(user_id=CLERK_ID, session_id=None)
    app.dependency_overrides[get_conn] = lambda: db
    app.dependency_overrides[get_conn_factory] = lambda: (lambda: nullcontext(db))
    app.dependency_overrides[get_llm] = lambda: FakeChat(
        [{"corrections": [FIX]}, {"corrections": []}],
        [{"reaction": "Good.", "goal_covered": "purpose_of_trip"}, {"reaction": "Fine.", "goal_covered": "chosen_program"}],
    )
    routes._repeat_calls.clear()
    routes._repeat_times.clear()
    yield TestClient(app)
    app.dependency_overrides.clear()


def hear(monkeypatch, text):
    monkeypatch.setattr(routes, "transcribe", lambda *a, **k: Transcription(text, "groq", 0.3, 2.0, []))


def session_with_a_corrected_answer(client, db):
    user = get_or_create_by_clerk_id(db, CLERK_ID)
    update_profile(db, user["id"], {"level": "B1"})
    sid = client.post("/sessions", json={"scenario_id": "visa-us", "mode": "text"}).json()["session_id"]
    assert client.post(f"/sessions/{sid}/turn", data={"text": "I go to the US for study."}).status_code == 200
    return sid


def repeat(client, sid, turn=0):
    return client.post(f"/sessions/{sid}/repeat", data={"turn": str(turn)}, files={"audio": ("r.webm", b"RIFF-audio", "audio/webm")})


def test_the_corrected_sentence_said_again_is_nailed_for_free(client, db, monkeypatch):
    sid = session_with_a_corrected_answer(client, db)
    before = client.get("/me/credits").json()["balance"]
    hear(monkeypatch, "Um, I go to the US to study.")
    body = repeat(client, sid).json()
    assert body["nailed"] is True and body["missing"] == [] and body["tries_left"] == 2
    assert body["target"] == "I go to the US to study." and body["heard"] == "Um, I go to the US to study."
    assert client.get("/me/credits").json()["balance"] == before
    assert len(client.get(f"/sessions/{sid}").json()["turns"]) == 1  # the interview did not move on


def test_the_mistake_said_again_is_named_and_limited_to_three_tries(client, db, monkeypatch):
    sid = session_with_a_corrected_answer(client, db)
    hear(monkeypatch, "I go to the US for study.")
    first = repeat(client, sid).json()
    assert first["nailed"] is False and first["missing"] == ["to study"]
    assert repeat(client, sid).status_code == 200
    assert repeat(client, sid).json()["tries_left"] == 0
    assert repeat(client, sid).status_code == 429


def test_unclear_recording_costs_no_try(client, db, monkeypatch):
    sid = session_with_a_corrected_answer(client, db)
    hear(monkeypatch, "...")
    assert repeat(client, sid).status_code == 422
    hear(monkeypatch, "I go to the US to study.")
    assert repeat(client, sid).json()["tries_left"] == 2


def test_nothing_to_repeat_and_unknown_answer(client, db, monkeypatch):
    sid = session_with_a_corrected_answer(client, db)
    hear(monkeypatch, "I study computer science.")
    assert client.post(f"/sessions/{sid}/turn", data={"text": "I study computer science."}).status_code == 200
    assert repeat(client, sid, turn=1).status_code == 409  # that answer had no correction
    assert repeat(client, sid, turn=5).status_code == 404


def test_repeat_only_for_the_owner(client, db, monkeypatch):
    sid = session_with_a_corrected_answer(client, db)
    hear(monkeypatch, "I go to the US to study.")
    app.dependency_overrides[get_clerk_claims] = lambda: ClerkClaims(user_id="user_other_repeat", session_id=None)
    assert repeat(client, sid).status_code == 404


def test_hourly_cap_per_student(client, db, monkeypatch):
    monkeypatch.setattr(routes, "REPEATS_PER_HOUR", 1)
    sid = session_with_a_corrected_answer(client, db)
    hear(monkeypatch, "I go to the US to study.")
    assert repeat(client, sid).status_code == 200
    assert repeat(client, sid).status_code == 429
