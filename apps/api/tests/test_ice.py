"""ICE servers of the voice call: Cloudflare's TURN relay, the call switch, and who may ask (no network: Cloudflare is faked)."""
from contextlib import nullcontext

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.db.connection import get_conn, get_conn_factory
from app.db.users import get_or_create_by_clerk_id, update_profile
from app.main import app
from app.security import ClerkClaims, get_clerk_claims
from app.voice import ice

CLOUDFLARE = {
    "iceServers": [
        {"urls": ["stun:stun.cloudflare.com:3478"]},
        {
            "urls": [
                "turn:turn.cloudflare.com:3478?transport=udp",
                "turn:turn.cloudflare.com:53?transport=udp",
                "turn:turn.cloudflare.com:3478?transport=tcp",
                "turns:turn.cloudflare.com:443?transport=tcp",
            ],
            "username": "u",
            "credential": "c",
        },
    ]
}


@pytest.fixture(autouse=True)
def configured(monkeypatch):
    monkeypatch.setattr(settings, "cloudflare_turn_key_id", "key123")
    monkeypatch.setattr(settings, "cloudflare_turn_api_token", "secret-token")
    monkeypatch.setattr(settings, "voice_call_enabled", True)
    ice.reset()
    yield
    ice.reset()


def fake_cloudflare(calls: list, status: int = 201, body=CLOUDFLARE):
    def handler(request: httpx.Request):
        calls.append(request)
        return httpx.Response(status, json=body)

    return httpx.Client(transport=httpx.MockTransport(handler))


def test_the_credentials_are_asked_from_cloudflare_with_the_key_and_a_ttl():
    calls: list = []
    servers = ice.all_ice_servers(fake_cloudflare(calls))
    assert servers == CLOUDFLARE["iceServers"]
    r = calls[0]
    assert str(r.url) == "https://rtc.live.cloudflare.com/v1/turn/keys/key123/credentials/generate-ice-servers"
    assert r.headers["authorization"] == "Bearer secret-token"
    assert b'"ttl": 86400' in r.content or b'"ttl":86400' in r.content


def test_nothing_is_asked_without_a_key(monkeypatch):
    monkeypatch.setattr(settings, "cloudflare_turn_api_token", "")
    calls: list = []
    assert ice.all_ice_servers(fake_cloudflare(calls)) == [] and calls == []


def test_credentials_are_cached_for_half_of_their_lifetime():
    calls: list = []
    client = fake_cloudflare(calls)
    t = [1000.0]
    ice.all_ice_servers(client, now=lambda: t[0])
    t[0] += settings.turn_credentials_ttl_secs / 2 - 1
    ice.all_ice_servers(client, now=lambda: t[0])
    assert len(calls) == 1  # still fresh
    t[0] += 2
    ice.all_ice_servers(client, now=lambda: t[0])
    assert len(calls) == 2  # renewed once half of the lifetime is gone


def test_the_browser_gets_every_transport_but_the_port_53_ones():
    urls = [u for s in ice.browser_ice_servers(fake_cloudflare([])) for u in s["urls"]]
    assert "turns:turn.cloudflare.com:443?transport=tcp" in urls and "turn:turn.cloudflare.com:3478?transport=tcp" in urls
    assert not any(":53?" in u or u.endswith(":53") for u in urls)


def test_our_own_peer_gets_stun_and_turn_over_udp_only():
    urls = [u for s in ice.server_ice_servers(fake_cloudflare([])) for u in s["urls"]]
    assert urls == ["stun:stun.cloudflare.com:3478", "turn:turn.cloudflare.com:3478?transport=udp"]


def test_when_cloudflare_is_down_the_call_still_tries_and_cloudflare_is_not_hammered():
    calls: list = []
    down = fake_cloudflare(calls, status=500, body={})
    t = [0.0]
    assert ice.all_ice_servers(down, now=lambda: t[0]) == []
    t[0] += 5
    assert ice.all_ice_servers(down, now=lambda: t[0]) == [] and len(calls) == 1  # not asked again within 30 s
    t[0] += 30
    ice.all_ice_servers(down, now=lambda: t[0])
    assert len(calls) == 2


def test_an_outage_keeps_serving_the_credentials_that_are_still_valid():
    calls: list = []
    t = [0.0]
    ice.all_ice_servers(fake_cloudflare(calls), now=lambda: t[0])
    t[0] += settings.turn_credentials_ttl_secs / 2 + 1  # time to renew...
    assert ice.all_ice_servers(fake_cloudflare(calls, status=500, body={}), now=lambda: t[0]) == CLOUDFLARE["iceServers"]  # ...but they last


def test_a_malformed_answer_is_an_outage_not_a_crash():
    assert ice.all_ice_servers(fake_cloudflare([], body={"iceServers": []})) == []


# ---- the route ----

CLERK_ID = "user_ice_test"


@pytest.fixture
def client(db, monkeypatch):
    app.dependency_overrides[get_clerk_claims] = lambda: ClerkClaims(user_id=CLERK_ID, session_id=None)
    app.dependency_overrides[get_conn] = lambda: db
    app.dependency_overrides[get_conn_factory] = lambda: (lambda: nullcontext(db))
    monkeypatch.setattr(ice, "_fetch", lambda client=None: CLOUDFLARE["iceServers"])
    yield TestClient(app)
    app.dependency_overrides.clear()


def new_session(client, db):
    user = get_or_create_by_clerk_id(db, CLERK_ID)
    update_profile(db, user["id"], {"level": "B1"})
    return client.post("/sessions", json={"scenario_id": "visa-us", "mode": "text"}).json()["session_id"]


def test_the_route_gives_the_owner_the_relay_and_never_the_key(client, db):
    sid = new_session(client, db)
    body = client.get(f"/sessions/{sid}/ice-servers").json()
    assert body["call_enabled"] is True
    flat = str(body)
    assert "turns:turn.cloudflare.com:443?transport=tcp" in flat and ":53?" not in flat
    assert "secret-token" not in flat and "key123" not in flat  # only the short-lived credential leaves the server


def test_someone_else_cannot_ask_for_a_session_that_is_not_theirs(client, db):
    sid = new_session(client, db)
    app.dependency_overrides[get_clerk_claims] = lambda: ClerkClaims(user_id="user_ice_other", session_id=None)
    assert client.get(f"/sessions/{sid}/ice-servers").status_code == 404


def test_switching_the_call_off_hides_the_relay_and_refuses_offers(client, db, monkeypatch):
    sid = new_session(client, db)
    monkeypatch.setattr(settings, "voice_call_enabled", False)
    assert client.get(f"/sessions/{sid}/ice-servers").json() == {"call_enabled": False, "ice_servers": []}
    r = client.post(f"/sessions/{sid}/webrtc", json={"sdp": "v=0", "type": "offer"})
    assert r.status_code == 503
