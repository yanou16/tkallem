from fastapi import APIRouter, Depends, Query
from psycopg import Connection
from tkallem_agent.scenarios import list_scenarios, load_scenario

from app.db.connection import get_conn
from app.db.progress import get_top_mistakes
from app.db.sessions import list_sessions_for_user
from app.dependencies import get_current_user

router = APIRouter(prefix="/api/practice", tags=["practice"])


def _format_scenario(s) -> dict:
    # Use real scenario attributes from tkallem_agent
    first_q = s.questions[0] if s.questions else s.opening or ""
    return {
        "id": s.id,
        "title": s.title,
        "subtitle": first_q[:60] + "..." if len(first_q) > 60 else first_q,
        "description": s.coach_role,
        "duration": s.minutes or 5,
        "level": "Guided" if s.mode == "guided" else "Free",
        "category": s.id.split("-")[0] if "-" in s.id else "speaking",
        "icon": "briefcase" if "job" in s.id else "plane" if "visa" in s.id else "graduationCap" if "campus" in s.id or "ielts" in s.id else "messageCircle",
    }


@router.get("/scenarios")
def get_scenarios(
    category: str | None = Query(None),
) -> list[dict]:
    scenarios = [_format_scenario(s) for s in list_scenarios()]
    if category and category != "all":
        return [s for s in scenarios if s["category"].lower() == category.lower()]
    return scenarios


@router.get("/sessions/recent")
def get_recent_practice_sessions(
    user: dict = Depends(get_current_user),
    conn: Connection = Depends(get_conn),
) -> list[dict]:
    # Strictly real sessions from DB
    rows = list_sessions_for_user(conn, user["id"], limit=5)
    recent = []
    for r in rows:
        try:
            scenario = load_scenario(r["scenario_id"])
            title = scenario.title
            subtitle = scenario.coach_role[:60] + "..." if len(scenario.coach_role) > 60 else scenario.coach_role
            duration = scenario.minutes or 5
        except Exception:
            title = r["scenario_id"].replace("-", " ").title()
            subtitle = "Practice session"
            duration = 5

        recent.append({
            "id": r["id"].hex,
            "scenarioId": r["scenario_id"],
            "title": title,
            "subtitle": subtitle,
            "duration": duration,
            "level": user.get("level") or "B1",
            "icon": "messageSquare",
        })
    return recent


@router.get("/recommended")
def get_recommended_scenarios(
    user: dict = Depends(get_current_user),
) -> list[dict]:
    # Return real loaded scenarios
    return [_format_scenario(s) for s in list_scenarios()[:3]]


@router.get("/focus")
def get_practice_focus(
    user: dict = Depends(get_current_user),
    conn: Connection = Depends(get_conn),
) -> dict | None:
    # Strictly from real student mistakes in the DB. If none, return None (triggers EmptyState)
    mistakes = get_top_mistakes(conn, user["id"])
    if not mistakes:
        return None

    top = mistakes[0]
    return {
        "scenarioId": "free-talk",
        "title": f"Work on {top['category'].title()}",
        "description": f"Review: \"{top['original']}\" → \"{top['correction']}\"",
        "reason": f"Detected {top['count']} correction(s) in category '{top['category']}'.",
        "icon": "target",
    }
