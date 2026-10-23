"""Phrase of the day on the routes (GET /phrase-of-the-day, POST /phrase-of-the-day/check). No network: the transcription
is replaced in the routes module, and the day is fixed."""
from contextlib import nullcontext
from datetime import date

import pytest
from fastapi.testclient import TestClient

from app import rate_limit
from app.config import settings
from app.db.connection import get_conn, get_conn_factory
from app.main import app
from app.phrase_of_the_day import FIRST_DAY, PHRASES
from app.routes import phrase_of_the_day as routes
from app.security import ClerkClaims, get_clerk_claims
from app.voice.stt import SttError, Transcription

TODAY = PHRASES[0]  # raining-cats: "It is raining cats and dogs."


@pytest.fixture
def client(db, monkeypatch):
    app.dependency_overrides[get_clerk_claims] = lambda: ClerkClaims(user_id="user_phrase_test", session_id=None)
    app.dependency_overrides[get_conn] = lambda: db
    app.dependency_overrides[get_conn_factory] = lambda: (lambda: nullcontext(db))
    monkeypatch.setattr(routes, "algiers_today", lambda: FIRST_DAY)
    rate_limit.phrase_checks.reset()
    yield TestClient(app)
    rate_limit.phrase_checks.reset()
    app.dependency_overrides.clear()


def hear(monkeypatch, text, **kw):
    monkeypatch.setattr(routes, "transcribe", lambda *a, **k: Transcription(text, "groq", 0.3, 2.0, [], **kw))


def say(client, **extra):
    return client.post("/phrase-of-the-day/check", files={"audio": ("p.webm", b"RIFF-audio", "audio/webm")}, data=extra)


def test_everyone_can_read_todays_phrase_without_an_account():
    app.dependency_overrides.clear()
    body = TestClient(app).get("/phrase-of-the-day").json()
    assert set(body) == {"date", "id", "kind", "text", "fr", "en", "example"}
    assert date.fromisoformat(body["date"])  # today in Algiers
    assert body["text"] in {p["text"] for p in PHRASES}


def test_the_phrase_said_right_is_nailed_even_with_a_contraction_or_a_filler(client, monkeypatch):
    hear(monkeypatch, "Um, it's raining cats and dogs.")  # a filler and a contraction
    body = say(client).json()
    assert body["nailed"] is True and body["missing"] == [] and body["target"] == TODAY["text"]
    assert body["heard"].startswith("Um")


def test_a_wrong_phrase_is_not_nailed_and_says_what_was_heard(client, monkeypatch):
    hear(monkeypatch, "It is raining a lot today.")
    body = say(client).json()
    assert body["nailed"] is False and body["similarity"] < 0.85 and body["heard"] == "It is raining a lot today."


def test_the_client_cannot_choose_which_phrase_it_speaks(client, monkeypatch):
    hear(monkeypatch, PHRASES[5]["text"])  # it says another phrase of the list and claims it is that one
    body = say(client, phrase_id=PHRASES[5]["id"], text=PHRASES[5]["text"]).json()
    assert body["nailed"] is False and body["target"] == TODAY["text"]


def test_silence_and_text_in_another_alphabet_are_asked_again(client, monkeypatch):
    hear(monkeypatch, ".")
    assert say(client).status_code == 422
    hear(monkeypatch, "Спасибо, я хочу вернуться в Алжир после учёбы дома")
    assert say(client).status_code == 422


def test_a_provider_outage_is_a_502_and_unreadable_audio_a_422(client, monkeypatch):
    def down(*a, **k):
        raise SttError("provider down", 503)

    def bad(*a, **k):
        raise SttError("bad file", 415)

    monkeypatch.setattr(routes, "transcribe", down)
    assert say(client).status_code == 502
    monkeypatch.setattr(routes, "transcribe", bad)
    assert say(client).status_code == 422


def test_too_many_tries_in_an_hour_are_refused(client, monkeypatch):
    hear(monkeypatch, TODAY["text"])
    assert all(say(client).status_code == 200 for _ in range(rate_limit.phrase_checks.limit))
    assert say(client).status_code == 429


def test_a_huge_recording_is_refused(client, monkeypatch):
    hear(monkeypatch, TODAY["text"])
    monkeypatch.setattr(settings, "max_audio_bytes", 5)
    assert say(client).status_code == 413


def test_checking_needs_a_guest_or_a_student():
    app.dependency_overrides.clear()
    r = TestClient(app).post("/phrase-of-the-day/check", files={"audio": ("p.webm", b"x", "audio/webm")})
    assert r.status_code in (401, 403)
