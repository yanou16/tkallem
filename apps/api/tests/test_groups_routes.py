from contextlib import nullcontext
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app import guests, rate_limit
from app.db.connection import get_conn, get_conn_factory
from app.db.groups import GROUP_MAX_MEMBERS, REPORTS_TO_HIDE, join_group, leave_group
from app.db.sessions import create_session
from app.db.users import get_or_create_by_clerk_id, update_profile
from app.main import app
from app.routes.groups import load_themes
from app.security import ClerkClaims, get_clerk_claims

# Every route of the groups feature, with a valid body (method, path, json).
ROUTES = [
    ("GET", "/groups/recommended", None),
    ("POST", "/groups/join", None),
    ("POST", "/groups/1/join", None),
    ("GET", "/me/group", None),
    ("GET", "/groups/1", None),
    ("GET", "/groups/1/messages", None),
    ("POST", "/groups/1/messages", {"body": "Hello"}),
    ("DELETE", "/groups/1/members/me", None),
    ("POST", "/groups/1/messages/1/report", {"reason": "spam"}),
    ("GET", "/groups/1/leaderboard", None),
]


class Students:
    """Creates students in the test transaction and chooses who is calling the API."""

    def __init__(self, db):
        self.db = db
        self.current: str | None = None

    def new(self, first_name: str | None = "Amina", level: str | None = "B1") -> dict:
        user = get_or_create_by_clerk_id(self.db, f"user_groups_route_{uuid4().hex}")
        changes = {"first_name": first_name} if first_name else {}
        if level:
            changes["level"] = level
        return update_profile(self.db, user["id"], changes) if changes else user

    def act_as(self, user: dict) -> None:
        self.current = user["clerk_user_id"]


@pytest.fixture
def students(db):
    s = Students(db)
    app.dependency_overrides[get_clerk_claims] = lambda: ClerkClaims(user_id=s.current, session_id=None)
    app.dependency_overrides[get_conn] = lambda: db
    app.dependency_overrides[get_conn_factory] = lambda: (lambda: nullcontext(db))
    rate_limit.group_messages.reset()
    yield s
    app.dependency_overrides.clear()
    rate_limit.group_messages.reset()


@pytest.fixture
def client(students):
    return TestClient(app)


def new_group(db, level: str = "B1") -> int:
    return db.execute(
        "INSERT INTO groups (name, level) VALUES (%s, %s) RETURNING id", (f"Test {level} {uuid4().hex[:12]}", level)
    ).fetchone()["id"]


def member(students, group_id: int, first_name: str = "Member", level: str = "B1") -> dict:
    user = students.new(first_name, level)
    assert join_group(students.db, group_id, user["id"]) == "joined"
    return user


def send(client, group_id: int, body: str = "Hello everyone"):
    return client.post(f"/groups/{group_id}/messages", json={"body": body})


# ---------- every route: token and guests ----------

@pytest.mark.parametrize("method, path, body", ROUTES, ids=[f"{m} {p}" for m, p, _ in ROUTES])
def test_every_group_route_needs_a_token(method, path, body):
    assert TestClient(app).request(method, path, json=body).status_code == 401


@pytest.mark.parametrize("method, path, body", ROUTES, ids=[f"{m} {p}" for m, p, _ in ROUTES])
def test_guests_cannot_use_groups(students, client, method, path, body):
    students.current = guests.clerk_id(uuid4().hex)

    response = client.request(method, path, json=body)

    assert response.status_code == 403
    assert "account" in response.json()["detail"]


# ---------- GET /groups/recommended ----------

def test_recommended_needs_a_level(students, client):
    students.act_as(students.new(level=None))

    assert client.get("/groups/recommended").status_code == 409


def test_recommended_shows_groups_of_my_level_with_room(students, client, db):
    open_group, full_group, other_level = new_group(db, "B2"), new_group(db, "B2"), new_group(db, "A2")
    member(students, open_group, level="B2")
    for _ in range(GROUP_MAX_MEMBERS):
        member(students, full_group, level="B2")
    member(students, other_level, level="A2")  # another student's group of another level
    students.act_as(students.new(level="B2"))

    response = client.get("/groups/recommended")

    assert response.status_code == 200
    ours = [g for g in response.json() if g["id"] in {open_group, full_group, other_level}]
    assert [(g["id"], g["level"], g["member_count"]) for g in ours] == [(open_group, "B2", 1)]
    assert set(ours[0]["theme"]) == {"id", "title", "category"}
    assert ours[0]["last_activity"] is None


# ---------- POST /groups/join ----------

def test_join_creates_a_club_then_the_next_student_joins_it(students, client, db):
    amina, yacine = students.new("Amina", "C1"), students.new("Yacine", "C1")
    students.act_as(amina)
    if client.get("/groups/recommended").json():
        pytest.skip("the test database already has C1 groups with room")

    created = client.post("/groups/join")
    students.act_as(yacine)
    joined = client.post("/groups/join")

    assert created.status_code == 200
    assert created.json()["name"].startswith("English C1 Club #")
    assert joined.json()["id"] == created.json()["id"]
    assert joined.json()["member_count"] == 2


def test_join_needs_a_level(students, client):
    students.act_as(students.new(level=None))

    assert client.post("/groups/join").status_code == 409


def test_join_when_already_in_a_group(students, client, db):
    students.act_as(member(students, new_group(db)))

    response = client.post("/groups/join")

    assert response.status_code == 409
    assert "already in a group" in response.json()["detail"]


# ---------- POST /groups/{id}/join ----------

def test_join_a_given_group(students, client, db):
    group = new_group(db)
    member(students, group)
    students.act_as(students.new())

    response = client.post(f"/groups/{group}/join")

    assert response.status_code == 200
    assert (response.json()["id"], response.json()["member_count"]) == (group, 2)


def test_join_an_unknown_group(students, client):
    students.act_as(students.new())

    assert client.post("/groups/999999999/join").status_code == 404


def test_join_a_group_of_another_level(students, client, db):
    group = new_group(db, "C1")
    students.act_as(students.new(level="A2"))

    assert client.post(f"/groups/{group}/join").status_code == 403


def test_join_a_full_group(students, client, db):
    group = new_group(db)
    for _ in range(GROUP_MAX_MEMBERS):
        member(students, group)
    students.act_as(students.new())

    response = client.post(f"/groups/{group}/join")

    assert response.status_code == 409
    assert response.json()["detail"] == "This group is full"


def test_join_a_group_while_in_another_one(students, client, db):
    mine, other = new_group(db), new_group(db)
    students.act_as(member(students, mine))

    assert client.post(f"/groups/{other}/join").status_code == 409


# ---------- GET /me/group ----------

def test_my_group_is_null_without_a_group(students, client):
    students.act_as(students.new())

    response = client.get("/me/group")

    assert response.status_code == 200
    assert response.json() is None


def test_my_group_is_mine_not_another_students(students, client, db):
    mine, theirs = new_group(db), new_group(db)
    amina = member(students, mine)
    member(students, theirs)
    students.act_as(amina)

    body = client.get("/me/group").json()

    assert (body["id"], body["member_count"]) == (mine, 1)
    assert set(body["theme"]) == {"id", "title", "category"}


# ---------- GET /groups/{id} ----------

def test_group_details_for_a_member(students, client, db):
    group = new_group(db)
    amina = member(students, group, "Amina")
    member(students, group, "Yacine")
    students.act_as(amina)

    response = client.get(f"/groups/{group}")

    assert response.status_code == 200
    body = response.json()
    assert [m["first_name"] for m in body["members"]] == ["Amina", "Yacine"]
    assert set(body["theme"]) == {"id", "title", "category", "question"}
    assert body["theme"]["question"] in [q for theme in load_themes() for q in theme["questions"]]


def test_group_details_are_for_members_only(students, client, db):
    group = new_group(db)
    member(students, group)
    students.act_as(students.new())  # another student, not a member

    assert client.get(f"/groups/{group}").status_code == 403
    assert client.get("/groups/999999999").status_code == 404


# ---------- messages ----------

def test_send_and_read_messages(students, client, db):
    group = new_group(db)
    amina = member(students, group, "Amina")
    students.act_as(amina)

    sent = send(client, group, "   Hi, I am Amina from Oran.  ")

    assert sent.status_code == 200
    assert sent.json()["body"] == "Hi, I am Amina from Oran."
    assert sent.json()["author"] == {"id": amina["id"], "first_name": "Amina"}
    assert sent.json()["author_left"] is False
    assert client.get(f"/groups/{group}/messages").json() == [sent.json()]


def test_the_chat_works_by_reloading(students, client, db):
    group = new_group(db)
    amina, yacine = member(students, group, "Amina"), member(students, group, "Yacine")
    students.act_as(amina)
    first = send(client, group, "Hello!").json()
    students.act_as(yacine)
    seen = client.get(f"/groups/{group}/messages").json()
    students.act_as(amina)
    send(client, group, "How are you?")

    students.act_as(yacine)
    new = client.get(f"/groups/{group}/messages", params={"after_id": seen[-1]["id"]}).json()

    assert [m["id"] for m in seen] == [first["id"]]
    assert [m["body"] for m in new] == ["How are you?"]


def test_messages_by_pages(students, client, db):
    group = new_group(db)
    students.act_as(member(students, group))
    ids = [send(client, group, f"message {n}").json()["id"] for n in range(5)]

    latest = client.get(f"/groups/{group}/messages", params={"limit": 2}).json()
    before = client.get(f"/groups/{group}/messages", params={"before_id": ids[3], "limit": 2}).json()

    assert [m["id"] for m in latest] == ids[3:]
    assert [m["id"] for m in before] == ids[1:3]
    both = client.get(f"/groups/{group}/messages", params={"before_id": ids[3], "after_id": ids[1]})
    assert both.status_code == 422
    assert client.get(f"/groups/{group}/messages", params={"limit": 101}).status_code == 422


@pytest.mark.parametrize("body", [{"body": ""}, {"body": "   "}, {"body": "x" * 501}, {"body": "Hi", "html": "<b>"}],
                         ids=["empty", "spaces", "too_long", "extra_field"])
def test_send_an_invalid_message(students, client, db, body):
    group = new_group(db)
    students.act_as(member(students, group))

    assert client.post(f"/groups/{group}/messages", json=body).status_code == 422


def test_messages_are_for_members_only(students, client, db):
    group = new_group(db)
    member(students, group)
    students.act_as(students.new())  # another student

    assert send(client, group).status_code == 403
    assert client.get(f"/groups/{group}/messages").status_code == 403
    assert send(client, 999999999).status_code == 404


def test_at_most_20_messages_per_minute(students, client, db):
    group = new_group(db)
    students.act_as(member(students, group))

    statuses = [send(client, group, f"message {n}").status_code for n in range(21)]

    assert statuses == [200] * 20 + [429]
    assert "wait a minute" in send(client, group).json()["detail"]


# ---------- DELETE /groups/{id}/members/me ----------

def test_leave_a_group(students, client, db):
    group = new_group(db)
    amina, yacine = member(students, group, "Amina"), member(students, group, "Yacine")
    students.act_as(amina)
    send(client, group, "Goodbye!")

    response = client.delete(f"/groups/{group}/members/me")

    assert response.status_code == 204
    assert client.get("/me/group").json() is None
    assert client.get(f"/groups/{group}/messages").status_code == 403
    students.act_as(yacine)
    [message] = client.get(f"/groups/{group}/messages").json()
    assert (message["author"]["first_name"], message["author_left"]) == ("Amina", True)


def test_leave_a_group_i_am_not_in(students, client, db):
    group = new_group(db)
    member(students, group)
    students.act_as(students.new())

    assert client.delete(f"/groups/{group}/members/me").status_code == 403
    assert client.delete("/groups/999999999/members/me").status_code == 404


# ---------- reports ----------

def report(client, group_id: int, message_id: int, reason: str = "insult"):
    return client.post(f"/groups/{group_id}/messages/{message_id}/report", json={"reason": reason})


def test_a_message_is_hidden_after_three_reports(students, client, db):
    group = new_group(db)
    author = member(students, group, "Author")
    reporters = [member(students, group) for _ in range(REPORTS_TO_HIDE)]
    students.act_as(author)
    message = send(client, group, "rude words").json()

    results = []
    for reporter in reporters:
        students.act_as(reporter)
        results.append(report(client, group, message["id"]).json())

    assert results == [{"hidden": False}] * (REPORTS_TO_HIDE - 1) + [{"hidden": True}]
    assert client.get(f"/groups/{group}/messages").json() == []
    assert report(client, group, message["id"]).status_code == 404


def test_report_rules(students, client, db):
    group, other = new_group(db), new_group(db)
    author, reporter = member(students, group, "Author"), member(students, group)
    elsewhere = member(students, other)
    students.act_as(author)
    message = send(client, group).json()

    assert report(client, group, message["id"]).status_code == 403  # own message
    students.act_as(reporter)
    assert report(client, group, message["id"]).status_code == 200
    assert report(client, group, message["id"]).status_code == 409  # only once
    assert report(client, group, message["id"], "rude").status_code == 422
    assert report(client, group, 999999999).status_code == 404
    students.act_as(elsewhere)  # another student, not in this group
    assert report(client, group, message["id"]).status_code == 403


# ---------- GET /groups/{id}/leaderboard ----------

def practiced(db, user_id: int, days_back: int, seconds: float) -> None:
    """A finished spoken session `days_back` days ago: get_activity counts its spoken seconds."""
    sid = uuid4()
    create_session(db, sid, user_id, "visa-us", "voice", "fr", {"turns": []})
    db.execute(
        """
        UPDATE practice_sessions
        SET started_at = now() - make_interval(days => %s), ended_at = now() - make_interval(days => %s)
        WHERE id = %s
        """,
        (days_back, days_back, sid),
    )
    db.execute("INSERT INTO session_metrics (session_id, words, speaking_seconds) VALUES (%s, 50, %s)", (sid, seconds))


def test_leaderboard_ranks_members_by_practice_this_week_then_streak(students, client, db):
    group = new_group(db)
    amina, yacine, sara, nour = (member(students, group, name) for name in ("Amina", "Yacine", "Sara", "Nour"))
    practiced(db, amina["id"], 0, 300)
    practiced(db, yacine["id"], 1, 600)
    practiced(db, sara["id"], 0, 120)
    practiced(db, sara["id"], 1, 180)  # 300 s like Amina, but a 2-day streak
    practiced(db, nour["id"], 10, 900)  # more than 7 days ago: not this week
    students.act_as(amina)

    response = client.get(f"/groups/{group}/leaderboard")

    assert response.status_code == 200
    board = response.json()
    assert [(e["rank"], e["member"]["first_name"]) for e in board] == [(1, "Yacine"), (2, "Sara"), (3, "Amina"), (4, "Nour")]
    assert [e["week_seconds"] for e in board] == pytest.approx([600, 300, 300, 0])
    assert [e["streak_days"] for e in board] == [1, 2, 1, 0]
    assert [e["is_me"] for e in board] == [False, False, True, False]


def test_leaderboard_ties_share_a_rank(students, client, db):
    group = new_group(db)
    amina, yacine, sara = (member(students, group, name) for name in ("Amina", "Yacine", "Sara"))
    practiced(db, amina["id"], 0, 300)
    practiced(db, yacine["id"], 0, 300)
    students.act_as(sara)

    board = client.get(f"/groups/{group}/leaderboard").json()

    assert [e["rank"] for e in board] == [1, 1, 3]


def test_leaderboard_shows_only_current_members_of_this_group(students, client, db):
    group, other = new_group(db), new_group(db)
    amina, former = member(students, group, "Amina"), member(students, group, "Former")
    member(students, other, "Elsewhere")  # another student's group
    leave_group(db, group, former["id"])
    students.act_as(amina)

    board = client.get(f"/groups/{group}/leaderboard").json()

    assert [e["member"]["first_name"] for e in board] == ["Amina"]


def test_leaderboard_is_for_members_only(students, client, db):
    group = new_group(db)
    member(students, group)
    students.act_as(students.new())  # another student, not a member

    assert client.get(f"/groups/{group}/leaderboard").status_code == 403
    assert client.get("/groups/999999999/leaderboard").status_code == 404
