from fastapi import APIRouter, Depends, Query
from psycopg import Connection
from tkallem_agent import ScenarioNotFound
from tkallem_agent.scenarios import load_scenario

from app import guests
from app.db.achievements import get_achievement_facts
from app.db.connection import get_conn
from app.db.sessions import list_sessions_for_user
from app.db.users import update_profile
from app.dependencies import get_current_user
from app.schemas.achievements import Achievement
from app.schemas.me import Me, MeUpdate
from app.schemas.sessions import SessionSummary
from app.db.progress import get_activity, get_metrics, get_top_mistakes
from app.schemas.progress import Progress

router = APIRouter(prefix="/me", tags=["me"])

# Fixed catalog, in display order. Icons are names the front maps in apps/web/src/lib/icons.tsx.
ACHIEVEMENTS = [
    {"id": "first_session", "title": "First session", "description": "Finish your first practice session.", "icon": "star"},
    {"id": "sessions_10", "title": "Ten sessions", "description": "Finish 10 practice sessions.", "icon": "trophy"},
    {"id": "streak_3", "title": "3-day streak", "description": "Practice 3 days in a row.", "icon": "flame"},
    {"id": "streak_7", "title": "7-day streak", "description": "Practice 7 days in a row.", "icon": "flame"},
    {"id": "first_voice", "title": "First spoken session", "description": "Answer every question of a session out loud.", "icon": "mic"},
    {"id": "level_b1", "title": "Level B1", "description": "Practice at level B1 or above.", "icon": "growth"},
]


def _with_guest_flag(user: dict) -> dict:
    return {**user, "is_guest": guests.is_guest_clerk_id(user["clerk_user_id"])}


@router.get("", response_model=Me)
def read_me(user: dict = Depends(get_current_user)) -> dict:
    return _with_guest_flag(user)


@router.patch("", response_model=Me)
def update_me(
    body: MeUpdate,
    user: dict = Depends(get_current_user),
    conn: Connection = Depends(get_conn),
) -> dict:
    return _with_guest_flag(update_profile(conn, user["id"], body.changes()))


def _summary(row: dict) -> dict:
    try:
        scenario = load_scenario(row["scenario_id"])
    except ScenarioNotFound:
        title, total_questions = row["scenario_id"], None
    else:
        title = scenario.title
        total_questions = len(scenario.questions) if scenario.mode == "guided" else None

    return {
        "session_id": row["id"].hex,
        "scenario_id": row["scenario_id"],
        "title": title,
        "started_at": row["started_at"],
        "ended_at": row["ended_at"],
        "answered": row["answered"],
        "total_questions": total_questions,
    }


@router.get("/sessions", response_model=list[SessionSummary])
def read_my_sessions(
    limit: int = Query(5, ge=1, le=20),
    user: dict = Depends(get_current_user),
    conn: Connection = Depends(get_conn),
) -> list[dict]:
    rows = list_sessions_for_user(conn, user["id"], limit)
    return [_summary(row) for row in rows]

def _mistakes_change(current: dict, baseline: dict | None) -> float | None:
    if baseline is None:
        return None
    now, before = current["mistakes_per_100"], baseline["mistakes_per_100"]
    if now is None or before is None:
        return None
    return now - before


@router.get("/progress", response_model=Progress)
def read_my_progress(
    user: dict = Depends(get_current_user),
    conn: Connection = Depends(get_conn),
) -> dict:
    activity = get_activity(conn, user["id"])
    metrics = get_metrics(conn, user["id"])
    mistakes = get_top_mistakes(conn, user["id"])

    return {
        "current": metrics["current"],
        "baseline": metrics["baseline"],
        "mistakes_change": _mistakes_change(metrics["current"], metrics["baseline"]),
        "top_mistakes": [{"id": m["category"], **m} for m in mistakes],
        "week_speaking_seconds": activity["week_seconds"],
        "today_speaking_seconds": activity["today_seconds"],
        "daily_goal_seconds": user["daily_goal_minutes"] * 60,
        "streak_days": activity["streak_days"],
    }


def _achievements(facts: dict, level: str | None) -> list[dict]:
    unlocked = {
        "first_session": facts["finished_sessions"] >= 1,
        "sessions_10": facts["finished_sessions"] >= 10,
        "streak_3": facts["best_streak"] >= 3,
        "streak_7": facts["best_streak"] >= 7,
        "first_voice": facts["voice_sessions"] >= 1,
        "level_b1": level in ("B1", "B2", "C1"),
    }
    return [{**badge, "unlocked": unlocked[badge["id"]]} for badge in ACHIEVEMENTS]


@router.get("/achievements", response_model=list[Achievement])
def read_my_achievements(
    user: dict = Depends(get_current_user),
    conn: Connection = Depends(get_conn),
) -> list[dict]:
    return _achievements(get_achievement_facts(conn, user["id"]), user["level"])