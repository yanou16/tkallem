"""Guest mode and credits through the HTTP routes, exactly as the front will call them."""
from contextlib import nullcontext
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from starlette.requests import Request

from app import credits, guests
from app.config import settings
from app.db.connection import get_conn, get_conn_factory
from app.db.users import get_or_create_by_clerk_id
from app.main import app
from app.routes import sessions as routes
from app.routes.credits import client_ip
from app.routes.sessions import get_llm
from app.security import ClerkClaims, get_clerk_claims
from tkallem_agent.testing import FakeChat

FOUND = {"corrections": [{"original": "for study", "fixed": "to study", "type": "grammar", "why": "Le but : to + verbe."}]}
NONE = {"corrections": []}
GOOD = {"reaction": "Good.", "goal_covered": None}
SIGNED_IN = "user_credit_route"


@pytest.fixture(autouse=True)
def config(monkeypatch):
    monkeypatch.setattr(settings, "guest_secret", "z" * 48)
    monkeypatch.setattr(settings, "budget_cache_s", 0)  # exact budget in tests
    monkeypatch.setattr(settings, "daily_spend_cap", 10**6)


@pytest.fixture
def client(db):
    app.dependency_overrides[get_conn] = lambda: db
    app.dependency_overrides[get_conn_factory] = lambda: (lambda: nullcontext(db))
    app.dependency_overrides[get_llm] = lambda: FakeChat(found=[NONE] * 20, replies=[GOOD] * 20, text=["note"] * 5)
    yield TestClient(app)
    app.dependency_overrides.clear()


def as_signed_in(name=SIGNED_IN):
    app.dependency_overrides[get_clerk_claims] = lambda: ClerkClaims(user_id=name, session_id=None)


def new_guest(client):
    r = client.post("/guests")
    assert r.status_code == 201, r.text
    return r.json()["guest_token"], {"Authorization": f"Guest {r.json()['guest_token']}"}


def start(client, headers):
    assert client.patch("/me", json={"level": "B1"}, headers=headers).status_code == 200
    return client.post("/sessions", json={"scenario_id": "visa-us"}, headers=headers).json()["session_id"]


def answer(client, sid, headers, text="I go to the US for study."):
    return client.post(f"/sessions/{sid}/turn", data={"text": text}, headers=headers)


def set_balance(db, user_clerk_id, n):
    user = get_or_create_by_clerk_id(db, user_clerk_id)
    db.execute("UPDATE credit_wallets SET balance = %s WHERE user_id = %s", (n, user["id"]))


# ---- creating guests -----------------------------------------------------------------------------------------

def test_guest_creation_returns_a_token_and_40_credits(client):
    r = client.post("/guests")
    assert r.status_code == 201
    body = r.json()
    assert guests.verify(body["guest_token"]) and body["credits"] == {"balance": 40, "next_refill_at": None}


def test_guest_mode_is_off_without_a_secret(client, monkeypatch):
    monkeypatch.setattr(settings, "guest_secret", "")
    assert client.post("/guests").status_code == 503


def test_too_many_guests_from_one_address_returns_429(client, monkeypatch):
    monkeypatch.setattr(settings, "guest_ip_daily_cap", 1)
    monkeypatch.setattr(settings, "guest_daily_cap", 10**6)
    client.post("/guests")
    r = client.post("/guests")
    assert r.status_code == 429 and r.json()["detail"]["code"] == "guest_limit"


def test_client_ip_uses_the_last_trusted_proxy_entry(monkeypatch):
    def req(xff=None):
        headers = [(b"x-forwarded-for", xff.encode())] if xff else []
        return Request({"type": "http", "headers": headers, "client": ("10.9.9.9", 1)})

    assert client_ip(req("1.1.1.1")) == "10.9.9.9"                        # 0 hops: the socket
    monkeypatch.setattr(settings, "forwarded_hops", 1)
    assert client_ip(req("6.6.6.6, 2.2.2.2")) == "2.2.2.2"               # the client-forged entry is ignored
    assert client_ip(req()) == "10.9.9.9"
    assert client_ip(req("6.6.6.6, 41.1.2.3:51234")) == "41.1.2.3"       # Azure adds the port: ignored
    assert client_ip(req("[2001:db8::1]:443")) == "2001:db8::1"
    assert client_ip(req("2001:db8::1")) == "2001:db8::1"


# ---- using the app as a guest ------------------------------------------------------------------------------------

def test_a_guest_practises_and_each_answer_costs_one_credit(client):
    _, h = new_guest(client)
    me = client.get("/me", headers=h).json()
    assert me["is_guest"] is True
    sid = start(client, h)
    first = answer(client, sid, h)
    assert first.status_code == 200 and first.json()["credits"] == {"balance": 39, "next_refill_at": None}
    assert answer(client, sid, h, "I like it.").json()["credits"]["balance"] == 38
    assert client.get("/me/credits", headers=h).json()["balance"] == 38


def test_forged_or_foreign_guest_tokens_are_refused(client):
    token, _ = new_guest(client)
    for bad in (token[:-2] + "00", "g1." + "a" * 32 + "." + "b" * 64, "nonsense"):
        assert client.get("/me", headers={"Authorization": f"Guest {bad}"}).status_code == 401


def test_zero_credits_returns_402_with_the_return_date(client, db):
    token, h = new_guest(client)
    sid = start(client, h)
    set_balance(db, guests.clerk_id(guests.verify(token)), 0)
    r = answer(client, sid, h)
    assert r.status_code == 402 and r.json()["detail"] == {"code": "no_credits", "balance": 0, "next_refill_at": None}  # guest: sign in
    as_signed_in("user_zero_credits")
    client.get("/me/credits")
    set_balance(db, "user_zero_credits", 0)
    sid2 = start(client, {})
    r = answer(client, sid2, {})
    assert r.status_code == 402 and r.json()["detail"]["next_refill_at"].endswith("+00:00")


def test_a_failed_answer_is_refunded(client, db):
    _, h = new_guest(client)
    sid = start(client, h)
    app.dependency_overrides[get_llm] = lambda: FakeChat(found=[NONE], replies=[RuntimeError("provider down")])
    assert answer(client, sid, h).status_code == 502
    assert client.get("/me/credits", headers=h).json()["balance"] == 40
    assert answer(client, sid, h, "   ").status_code == 422                # empty answer: refunded too
    assert client.get("/me/credits", headers=h).json()["balance"] == 40


def test_a_failed_transcription_is_refunded(client, db, monkeypatch):
    from app.voice import SttError

    def boom(*a, **k):
        raise SttError("groq down", 500)

    monkeypatch.setattr(routes, "transcribe", boom)
    _, h = new_guest(client)
    sid = start(client, h)
    r = client.post(f"/sessions/{sid}/turn", files={"audio": ("a.webm", b"x", "audio/webm")}, headers=h)
    assert r.status_code == 502 and client.get("/me/credits", headers=h).json()["balance"] == 40


def test_the_daily_budget_returns_429_and_spends_nothing(client, monkeypatch):
    _, h = new_guest(client)
    sid = start(client, h)
    monkeypatch.setattr(settings, "daily_spend_cap", 0)
    r = answer(client, sid, h)
    assert r.status_code == 429 and r.json()["detail"]["code"] == "daily_budget_reached"
    monkeypatch.setattr(settings, "daily_spend_cap", 10**6)
    assert client.get("/me/credits", headers=h).json()["balance"] == 40


# ---- signing in ---------------------------------------------------------------------------------------------------

def test_signed_in_student_has_60_credits_and_a_refill_date(client):
    as_signed_in("user_credit_signed")
    body = client.get("/me/credits").json()
    assert body["balance"] == 60 and body["next_refill_at"] is not None
    assert client.get("/me").json()["is_guest"] is False


def test_claiming_a_guest_brings_its_credits_and_sessions(client, db):
    token, h = new_guest(client)
    sid = start(client, h)
    answer(client, sid, h)                                                  # 39 left
    as_signed_in("user_claimer")
    r = client.post("/me/claim-guest", json={"guest_token": token})
    assert r.status_code == 200 and r.json()["transferred"] == 39 and r.json()["credits"]["balance"] == 60 + 39
    assert client.get("/me/sessions").json()[0]["session_id"] == sid        # the practice history followed
    again = client.post("/me/claim-guest", json={"guest_token": token})
    assert again.json()["transferred"] == 0 and again.json()["credits"]["balance"] == 99


def test_claim_endpoint_rules(client):
    token, h = new_guest(client)
    assert client.post("/me/claim-guest", json={"guest_token": token}, headers=h).status_code == 403  # a guest cannot claim
    as_signed_in("user_claim_rules")
    assert client.post("/me/claim-guest", json={"guest_token": "g1." + "a" * 32 + "." + "b" * 64}).status_code == 422
    assert client.post("/me/claim-guest", json={"guest_token": token, "extra": 1}).status_code == 422


def test_a_valid_token_without_a_guest_row_is_refused_not_recreated(client, db):
    before = db.execute("SELECT count(*) AS n FROM users").fetchone()["n"]
    token = guests.issue(guests.new_guest_id())  # signed correctly, but POST /guests never created it
    r = client.get("/me", headers={"Authorization": f"Guest {token}"})
    assert r.status_code == 401
    assert db.execute("SELECT count(*) AS n FROM users").fetchone()["n"] == before


def test_turn_and_end_with_a_stale_guest_token_create_nothing(client, db):
    before = db.execute("SELECT count(*) AS n FROM users").fetchone()["n"]
    token = guests.issue(guests.new_guest_id())
    headers = {"Authorization": f"Guest {token}"}
    sid = "00000000-0000-0000-0000-000000000001"
    assert client.post(f"/sessions/{sid}/turn", data={"text": "Hello."}, headers=headers).status_code == 401
    assert client.post(f"/sessions/{sid}/end", headers=headers).status_code == 401
    assert db.execute("SELECT count(*) AS n FROM users").fetchone()["n"] == before
