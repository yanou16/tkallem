"""Practice groups (written English between students of the same level). REST to read and send; the WebSocket
(phase 3) only pushes what changed. Routes that write are `async def`: the database work runs in a thread
(run_in_threadpool) inside `with connect()`, which commits when the block ends, so what is pushed afterwards is
already saved."""
import json
from datetime import date
from functools import lru_cache
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.concurrency import run_in_threadpool
from psycopg import Connection

from app import guests, rate_limit
from app.db.connection import ConnFactory, get_conn, get_conn_factory
from app.db.groups import (
    get_group,
    get_user_group,
    insert_message,
    is_member,
    join_best_group,
    join_group,
    leave_group,
    list_members,
    list_messages,
    recommended_groups,
    report_message,
)
from app.db.progress import TIMEZONE
from app.dependencies import user_for_claims
from app.schemas.groups import (
    GroupDetail,
    GroupMessage,
    GroupSummary,
    GroupThemeFile,
    MessageCreate,
    ReportCreate,
    ReportResult,
)
from app.security import ClerkClaims, get_clerk_claims

router = APIRouter(tags=["groups"])

RECOMMENDED_LIMIT = 20
THEMES_FILE = Path(__file__).resolve().parents[1] / "data" / "group_themes.json"
THEMES_EPOCH = date(2024, 1, 1)  # a Monday: week 0 of the rotation


# ---------- theme of the week ----------

@lru_cache
def load_themes() -> tuple[dict, ...]:
    """The themes of app/data/group_themes.json, checked once (8 themes x 7 questions, reviewed by the team)."""
    raw = json.loads(THEMES_FILE.read_text(encoding="utf-8"))
    return tuple(GroupThemeFile.model_validate(theme).model_dump() for theme in raw)


def theme_of_the_day(day: date) -> dict:
    """Same theme for every group. The week number since a fixed Monday picks the theme (it changes on Monday at
    midnight), the day of the week picks the question. No randomness: the same day always gives the same question."""
    themes = load_themes()
    theme = themes[((day - THEMES_EPOCH).days // 7) % len(themes)]
    return {
        "id": theme["id"],
        "title": theme["title"],
        "category": theme["category"],
        "question": theme["questions"][day.weekday()],  # Monday = 0
    }


def algiers_today(conn: Connection) -> date:
    """Today in Algiers time, from the database clock (like the streak in app/db/progress.py)."""
    return conn.execute("SELECT (now() AT TIME ZONE %s)::date AS today", (TIMEZONE,)).fetchone()["today"]


# ---------- who may use groups ----------

def student_claims(claims: ClerkClaims = Depends(get_clerk_claims)) -> ClerkClaims:
    """Groups are between real students: guests (no account) are refused."""
    if guests.is_guest_clerk_id(claims.user_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Groups are for students with an account: sign up to join one")
    return claims


def get_student(claims: ClerkClaims = Depends(student_claims), conn: Connection = Depends(get_conn)) -> dict:
    return user_for_claims(conn, claims)


def _require_level(user: dict) -> str:
    if user["level"] is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Choose your level first (PATCH /me)")
    return user["level"]


def _member_group(conn: Connection, group_id: int, user_id: int) -> dict:
    """The group, if it exists (404) and the student is one of its members (403)."""
    group = get_group(conn, group_id)
    if group is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Group not found")
    if not is_member(conn, group_id, user_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You are not a member of this group")
    return group


def _already_in_a_group() -> HTTPException:
    return HTTPException(status.HTTP_409_CONFLICT, "You are already in a group: leave it first")


# ---------- shapes ----------

def _summary(group: dict, today: date) -> dict:
    theme = theme_of_the_day(today)
    return {
        "id": group["id"],
        "name": group["name"],
        "level": group["level"],
        "member_count": group["member_count"],
        "last_activity": group["last_activity"],
        "theme": {"id": theme["id"], "title": theme["title"], "category": theme["category"]},
    }


def _message(row: dict) -> dict:
    return {
        "id": row["id"],
        "body": row["body"],
        "created_at": row["created_at"],
        "author": {"id": row["author_id"], "first_name": row["author_first_name"]},
        "author_left": row["author_left"],
    }


# ---------- routes (static paths before /groups/{group_id}) ----------

@router.get("/groups/recommended", response_model=list[GroupSummary])
def read_recommended_groups(student: dict = Depends(get_student), conn: Connection = Depends(get_conn)) -> list[dict]:
    """Groups of the student's level with room left, the most recently active first (silent groups last)."""
    level = _require_level(student)
    today = algiers_today(conn)
    return [_summary(group, today) for group in recommended_groups(conn, level, limit=RECOMMENDED_LIMIT)]


@router.post("/groups/join", response_model=GroupSummary)
async def join_a_group(
    claims: ClerkClaims = Depends(student_claims),
    connect: ConnFactory = Depends(get_conn_factory),
) -> dict:
    """Joins the most active group of the student's level with room left, or a new "English B1 Club #N"."""
    def join() -> dict:
        with connect() as conn:
            student = user_for_claims(conn, claims)
            level = _require_level(student)
            if get_user_group(conn, student["id"]) is not None:
                raise _already_in_a_group()
            group = join_best_group(conn, student["id"], level)
            if group is None:  # joined another group in the meantime
                raise _already_in_a_group()
            return _summary(group, algiers_today(conn))

    return await run_in_threadpool(join)


@router.post("/groups/{group_id}/join", response_model=GroupSummary)
async def join_this_group(
    group_id: int,
    claims: ClerkClaims = Depends(student_claims),
    connect: ConnFactory = Depends(get_conn_factory),
) -> dict:
    def join() -> dict:
        with connect() as conn:
            student = user_for_claims(conn, claims)
            level = _require_level(student)
            group = get_group(conn, group_id)
            if group is None:
                raise HTTPException(status.HTTP_404_NOT_FOUND, "Group not found")
            if group["level"] != level:
                raise HTTPException(status.HTTP_403_FORBIDDEN, f"This group is for level {group['level']}")
            if get_user_group(conn, student["id"]) is not None:
                raise _already_in_a_group()
            result = join_group(conn, group_id, student["id"])
            if result == "full":
                raise HTTPException(status.HTTP_409_CONFLICT, "This group is full")
            if result == "already_member":
                raise _already_in_a_group()
            if result == "not_found":
                raise HTTPException(status.HTTP_404_NOT_FOUND, "Group not found")
            return _summary(get_group(conn, group_id), algiers_today(conn))

    return await run_in_threadpool(join)


@router.get("/me/group", response_model=GroupSummary | None)
def read_my_group(student: dict = Depends(get_student), conn: Connection = Depends(get_conn)) -> dict | None:
    group = get_user_group(conn, student["id"])
    return None if group is None else _summary(group, algiers_today(conn))


@router.get("/groups/{group_id}", response_model=GroupDetail)
def read_group(group_id: int, student: dict = Depends(get_student), conn: Connection = Depends(get_conn)) -> dict:
    group = _member_group(conn, group_id, student["id"])
    return {
        "id": group["id"],
        "name": group["name"],
        "level": group["level"],
        "members": [{"id": m["id"], "first_name": m["first_name"]} for m in list_members(conn, group_id)],
        "theme": theme_of_the_day(algiers_today(conn)),
    }


@router.get("/groups/{group_id}/messages", response_model=list[GroupMessage])
def read_messages(
    group_id: int,
    before_id: int | None = Query(None, ge=1),
    after_id: int | None = Query(None, ge=1),
    limit: int = Query(50, ge=1, le=100),
    student: dict = Depends(get_student),
    conn: Connection = Depends(get_conn),
) -> list[dict]:
    """Visible messages, oldest first. before_id: the page before (scrolling up). after_id: what came after
    (catching up after a reconnection). Without either: the latest messages."""
    _member_group(conn, group_id, student["id"])
    if before_id is not None and after_id is not None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Use before_id or after_id, not both")
    rows = list_messages(conn, group_id, before_id=before_id, after_id=after_id, limit=limit)
    return [_message(row) for row in rows]


@router.post("/groups/{group_id}/messages", response_model=GroupMessage)
async def send_message(
    group_id: int,
    body: MessageCreate,
    claims: ClerkClaims = Depends(student_claims),
    connect: ConnFactory = Depends(get_conn_factory),
) -> dict:
    if not rate_limit.group_messages.allow(claims.user_id):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many messages: wait a minute before sending more")

    def save() -> dict:
        with connect() as conn:
            student = user_for_claims(conn, claims)
            if get_group(conn, group_id) is None:
                raise HTTPException(status.HTTP_404_NOT_FOUND, "Group not found")
            row = insert_message(conn, group_id, student["id"], body.body)  # membership checked in the same INSERT
            if row is None:
                raise HTTPException(status.HTTP_403_FORBIDDEN, "You are not a member of this group")
            return _message(row)

    message = await run_in_threadpool(save)  # committed when `with connect()` ended
    return message


@router.delete("/groups/{group_id}/members/me", status_code=status.HTTP_204_NO_CONTENT)
async def leave_this_group(
    group_id: int,
    claims: ClerkClaims = Depends(student_claims),
    connect: ConnFactory = Depends(get_conn_factory),
) -> Response:
    def leave() -> None:
        with connect() as conn:
            student = user_for_claims(conn, claims)
            if get_group(conn, group_id) is None:
                raise HTTPException(status.HTTP_404_NOT_FOUND, "Group not found")
            if not leave_group(conn, group_id, student["id"]):
                raise HTTPException(status.HTTP_403_FORBIDDEN, "You are not a member of this group")

    await run_in_threadpool(leave)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/groups/{group_id}/messages/{message_id}/report", response_model=ReportResult)
async def report_a_message(
    group_id: int,
    message_id: int,
    body: ReportCreate,
    claims: ClerkClaims = Depends(student_claims),
    connect: ConnFactory = Depends(get_conn_factory),
) -> dict:
    """Reports another member's message, once. Hidden for the whole group at REPORTS_TO_HIDE different reports."""
    def report() -> str:
        with connect() as conn:
            student = user_for_claims(conn, claims)
            _member_group(conn, group_id, student["id"])
            return report_message(conn, group_id, message_id, student["id"], body.reason)

    result = await run_in_threadpool(report)
    if result == "not_found":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Message not found")
    if result == "own_message":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You cannot report your own message")
    if result == "already_reported":
        raise HTTPException(status.HTTP_409_CONFLICT, "You already reported this message")
    return {"hidden": result == "hidden"}
