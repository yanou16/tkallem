from fastapi import APIRouter, Depends, Query
from psycopg import Connection
from tkallem_agent import ScenarioNotFound
from tkallem_agent.scenarios import load_scenario

from app.db.connection import get_conn
from app.db.sessions import list_sessions_for_user
from app.db.users import update_profile
from app.dependencies import get_current_user
from app.schemas.me import Me, MeUpdate
from app.schemas.sessions import SessionSummary
from app.db.progress import get_activity, get_metrics, get_top_mistakes
from app.schemas.progress import Progress

router = APIRouter(prefix="/me", tags=["me"])


@router.get("", response_model=Me)
def read_me(user: dict = Depends(get_current_user)) -> dict:
    return user


@router.patch("", response_model=Me)
def update_me(
    body: MeUpdate,
    user: dict = Depends(get_current_user),
    conn: Connection = Depends(get_conn),
) -> dict:
    return update_profile(conn, user["id"], body.changes())


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