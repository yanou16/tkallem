import asyncio
from contextlib import nullcontext
from uuid import uuid4

import jwt
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app import rate_limit, realtime, security
from app.config import settings
from app.db.connection import get_conn, get_conn_factory
from app.db.groups import REPORTS_TO_HIDE, join_group
from app.db.users import get_or_create_by_clerk_id, update_profile
from app.main import app
from app.routes import group_ws
from app.security import ClerkClaims, get_clerk_claims

ORIGIN = settings.frontend_origins[0]


def fake_verify(token: str) -> ClerkClaims:
    """Stands for verify_clerk_token (no Clerk in tests): "clerk:<clerk user id>" is a valid token."""
    if token == "clerk-down":
        raise HTTPException(503, "Authentication service unavailable")
    if not token.startswith("clerk:"):
        raise HTTPException(401, "Invalid or expired token")
    return ClerkClaims(user_id=token.removeprefix("clerk:"), session_id=None)


class World:
    """Students and groups in the test transaction; `act_as` chooses who calls the REST routes."""

    def __init__(self, db):
        self.db = db
        self.current: str | None = None
        self.client: TestClient | None = None

    def student(self, first_name: str = "Member", level: str = "B1") -> dict:
        user = get_or_create_by_clerk_id(self.db, f"user_groups_ws_{uuid4().hex}")
        return update_profile(self.db, user["id"], {"first_name": first_name, "level": level})

    def group(self, level: str = "B1") -> int:
        return self.db.execute(
            "INSERT INTO groups (name, level) VALUES (%s, %s) RETURNING id", (f"WS {level} {uuid4().hex[:12]}", level)
        ).fetchone()["id"]

    def member(self, group_id: int, first_name: str = "Member") -> dict:
        user = self.student(first_name)
        assert join_group(self.db, group_id, user["id"]) == "joined"
        return user

    def act_as(self, user: dict) -> None:
        self.current = user["clerk_user_id"]

    def ws(self, group_id: int, origin: str | None = ORIGIN):
        headers = {"origin": origin} if origin else {}
        return self.client.websocket_connect(f"/ws/groups/{group_id}", headers=headers)


@pytest.fixture
def world(db, monkeypatch):
    monkeypatch.setattr(settings, "database_url", "")  # the app starts (lifespan) without opening the dev pool
    monkeypatch.setattr(group_ws, "verify_clerk_token", fake_verify)
    monkeypatch.setattr(realtime, "manager", realtime.ConnectionManager())  # no connection left from another test
    w = World(db)
    app.dependency_overrides[get_clerk_claims] = lambda: ClerkClaims(user_id=w.current, session_id=None)
    app.dependency_overrides[get_conn] = lambda: db
    app.dependency_overrides[get_conn_factory] = lambda: (lambda: nullcontext(db))
    rate_limit.group_messages.reset()
    with TestClient(app) as client:  # one event loop for the REST calls and the WebSockets
        w.client = client
        yield w
    app.dependency_overrides.clear()
    rate_limit.group_messages.reset()


def authenticate(ws, user: dict) -> None:
    ws.send_json({"type": "auth", "token": f"clerk:{user['clerk_user_id']}"})
    assert ws.receive_json() == {"type": "auth.ok"}


def close_code(ws) -> int:
    with pytest.raises(WebSocketDisconnect) as closed:
        ws.receive_json()
    return closed.value.code


# ---------- authentication and access ----------

def test_a_member_is_authenticated_and_gets_pong(world):
    group = world.group()
    amina = world.member(group, "Amina")

    with world.ws(group) as ws:
        authenticate(ws, amina)
        ws.send_json({"type": "ping"})
        assert ws.receive_json() == {"type": "pong"}


@pytest.mark.parametrize("first", [{"type": "auth"}, {"type": "ping"}, {"type": "auth", "token": ""}, "not json"],
                         ids=["no_token", "not_auth", "empty_token", "not_json"])
def test_closes_4401_without_a_token(world, first):
    group = world.group()
    world.member(group)

    with world.ws(group) as ws:
        ws.send_text(first) if isinstance(first, str) else ws.send_json(first)
        assert close_code(ws) == 4401


def test_closes_4401_with_an_invalid_token(world):
    group = world.group()
    world.member(group)

    with world.ws(group) as ws:
        ws.send_json({"type": "auth", "token": "forged"})
        assert close_code(ws) == 4401


def test_closes_4401_when_the_token_comes_too_late(world, monkeypatch):
    monkeypatch.setattr(group_ws, "AUTH_TIMEOUT_S", 0.2)
    group = world.group()
    world.member(group)

    with world.ws(group) as ws:
        assert close_code(ws) == 4401


def test_a_guest_token_is_refused_by_the_real_check(world, monkeypatch):
    # The real verify_clerk_token: a guest token is not a JWT, refused before any call to Clerk.
    monkeypatch.setattr(group_ws, "verify_clerk_token", security.verify_clerk_token)
    monkeypatch.setattr(settings, "clerk_jwks_url", "https://clerk.invalid/.well-known/jwks.json")
    monkeypatch.setattr(settings, "clerk_issuer", "https://clerk.invalid")
    # A client of its own: the cached one (lru_cache) must not keep this fake URL for the next tests.
    monkeypatch.setattr(security, "_jwks_client", lambda: jwt.PyJWKClient(settings.clerk_jwks_url))
    group = world.group()
    world.member(group)

    with world.ws(group) as ws:
        ws.send_json({"type": "auth", "token": "g1." + "0" * 32 + "." + "0" * 64})
        assert close_code(ws) == 4401


def test_closes_1011_when_clerk_cannot_be_reached(world):
    group = world.group()
    world.member(group)

    with world.ws(group) as ws:
        ws.send_json({"type": "auth", "token": "clerk-down"})
        assert close_code(ws) == 1011


@pytest.mark.parametrize("origin", ["https://evil.example", None], ids=["other_site", "no_origin"])
def test_closes_1008_for_another_origin(world, origin):
    group = world.group()

    with world.ws(group, origin=origin) as ws:
        assert close_code(ws) == 1008


def test_closes_4403_for_a_student_who_is_not_a_member(world):
    group = world.group()
    world.member(group)
    stranger = world.student()  # another student, in no group

    with world.ws(group) as ws:
        ws.send_json({"type": "auth", "token": f"clerk:{stranger['clerk_user_id']}"})
        assert close_code(ws) == 4403


def test_closes_4404_for_an_unknown_group(world):
    amina = world.student()

    with world.ws(999_999_999) as ws:
        ws.send_json({"type": "auth", "token": f"clerk:{amina['clerk_user_id']}"})
        assert close_code(ws) == 4404


def test_other_client_messages_are_ignored(world):
    group = world.group()
    amina = world.member(group)

    with world.ws(group) as ws:
        authenticate(ws, amina)
        ws.send_json({"type": "message.create", "body": "sending goes through REST"})
        ws.send_text("{not json")
        ws.send_bytes(b"\x00\x01")
        ws.send_json({"type": "ping"})
        assert ws.receive_json() == {"type": "pong"}  # nothing else came before


# ---------- events ----------

def test_members_receive_new_messages_in_the_shape_of_get_messages(world):
    group = world.group()
    amina, yacine = world.member(group, "Amina"), world.member(group, "Yacine")

    with world.ws(group) as ws:
        authenticate(ws, amina)
        world.act_as(yacine)
        sent = world.client.post(f"/groups/{group}/messages", json={"body": "Hello Amina!"}).json()

        event = ws.receive_json()

    assert event == {"type": "message.created", "message": sent}
    assert world.client.get(f"/groups/{group}/messages").json() == [event["message"]]


def test_another_group_receives_nothing(world):
    group, other = world.group(), world.group()
    amina, bob = world.member(group, "Amina"), world.member(other, "Bob")

    with world.ws(other) as ws:
        authenticate(ws, bob)
        world.act_as(amina)
        world.client.post(f"/groups/{group}/messages", json={"body": "Only for my group"})
        world.act_as(bob)
        world.client.post(f"/groups/{other}/messages", json={"body": "In Bob's group"})

        event = ws.receive_json()

    assert event["message"]["body"] == "In Bob's group"  # the first event is not the other group's message


def test_members_are_told_when_someone_joins(world):
    group = world.group()
    yacine = world.member(group, "Yacine")
    amina = world.student("Amina")

    with world.ws(group) as ws:
        authenticate(ws, yacine)
        world.act_as(amina)
        assert world.client.post(f"/groups/{group}/join").status_code == 200

        assert ws.receive_json() == {"type": "member.joined", "member": {"id": amina["id"], "first_name": "Amina"}}


def test_leaving_closes_all_my_tabs_and_tells_the_others(world):
    group = world.group()
    amina, yacine = world.member(group, "Amina"), world.member(group, "Yacine")

    with world.ws(group) as tab1, world.ws(group) as tab2, world.ws(group) as other:
        authenticate(tab1, amina)
        authenticate(tab2, amina)
        authenticate(other, yacine)
        world.act_as(amina)
        assert world.client.delete(f"/groups/{group}/members/me").status_code == 204

        assert close_code(tab1) == 4403
        assert close_code(tab2) == 4403
        assert other.receive_json() == {"type": "member.left", "member": {"id": amina["id"], "first_name": "Amina"}}
    assert realtime.manager.connection_count(group) == 0


def test_members_are_told_when_a_message_is_hidden(world):
    group = world.group()
    author = world.member(group, "Author")
    reporters = [world.member(group) for _ in range(REPORTS_TO_HIDE)]
    world.act_as(author)
    message = world.client.post(f"/groups/{group}/messages", json={"body": "rude words"}).json()

    with world.ws(group) as ws:
        authenticate(ws, author)
        for reporter in reporters:
            world.act_as(reporter)
            world.client.post(f"/groups/{group}/messages/{message['id']}/report", json={"reason": "insult"})

        assert ws.receive_json() == {"type": "message.hidden", "message_id": message["id"]}


def test_a_closed_connection_is_forgotten(world):
    group = world.group()
    amina = world.member(group)

    with world.ws(group) as ws:
        authenticate(ws, amina)
        assert realtime.manager.connection_count(group) == 1
    world.act_as(amina)
    world.client.post(f"/groups/{group}/messages", json={"body": "nobody is listening"})  # no error

    assert realtime.manager.connection_count(group) == 0


# ---------- ConnectionManager alone ----------

class FakeSocket:
    def __init__(self, fail: bool = False, slow: bool = False):
        self.sent: list[dict] = []
        self.closed_with: int | None = None
        self.fail, self.slow = fail, slow

    async def send_json(self, data: dict) -> None:
        if self.fail:
            raise RuntimeError("connection lost")
        if self.slow:
            await asyncio.sleep(10)
        self.sent.append(data)

    async def close(self, code: int = 1000) -> None:
        self.closed_with = code


def test_broadcast_drops_dead_and_stuck_connections(monkeypatch):
    monkeypatch.setattr(realtime, "SEND_TIMEOUT_S", 0.05)

    async def scenario():
        manager = realtime.ConnectionManager()
        alive, dead, stuck = FakeSocket(), FakeSocket(fail=True), FakeSocket(slow=True)
        for user_id, socket in [(1, alive), (2, dead), (3, stuck)]:
            await manager.connect(7, user_id, socket)
        await manager.broadcast(7, {"type": "pong"})
        return alive.sent, manager.connection_count(7)

    sent, remaining = asyncio.run(scenario())

    assert sent == [{"type": "pong"}]
    assert remaining == 1


def test_close_member_closes_only_her_connections_in_that_group():
    async def scenario():
        manager = realtime.ConnectionManager()
        hers, also_hers, his, elsewhere = FakeSocket(), FakeSocket(), FakeSocket(), FakeSocket()
        await manager.connect(7, 1, hers)
        await manager.connect(7, 1, also_hers)
        await manager.connect(7, 2, his)
        await manager.connect(8, 1, elsewhere)
        await manager.close_member(7, 1)
        return [s.closed_with for s in (hers, also_hers, his, elsewhere)], manager.connection_count(7)

    closed, remaining = asyncio.run(scenario())

    assert closed == [4403, 4403, None, None]
    assert remaining == 1
