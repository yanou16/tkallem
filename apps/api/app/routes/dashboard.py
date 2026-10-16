from fastapi import APIRouter, Depends
from psycopg import Connection

from app.db.connection import get_conn
from app.db.progress import get_activity, get_metrics, get_top_mistakes
from app.dependencies import get_current_user

router = APIRouter(tags=["dashboard"])


@router.get("/api/dashboard")
def get_dashboard(
    user: dict = Depends(get_current_user),
    conn: Connection = Depends(get_conn),
) -> dict:
    activity = get_activity(conn, user["id"])
    metrics = get_metrics(conn, user["id"])

    current = metrics.get("current") or {}
    baseline = metrics.get("baseline")

    mistakes_now = current.get("mistakes_per_100")
    mistakes_baseline = baseline.get("mistakes_per_100") if baseline else None
    
    mistakes_change = (
        round(mistakes_now - mistakes_baseline, 1)
        if (mistakes_now is not None and mistakes_baseline is not None)
        else None
    )

    return {
        "speakingSecondsThisWeek": activity["week_seconds"],
        "speakingMinutesThisWeek": round(activity["week_seconds"] / 60, 1) if activity["week_seconds"] else 0,
        "streakDays": activity["streak_days"],
        "mistakesPer100Words": round(mistakes_now, 1) if mistakes_now is not None else None,
        "mistakesChange": mistakes_change,
        "mistakesChangeLabel": "vs baseline" if mistakes_change is not None else None,
        "dailyGoalMinutes": 10,
        "dailyCompletedSeconds": activity["today_seconds"],
        "dailyCompletedMinutes": round(activity["today_seconds"] / 60, 1) if activity["today_seconds"] else 0,
    }


@router.get("/api/mistakes/top")
def get_top_mistakes_endpoint(
    user: dict = Depends(get_current_user),
    conn: Connection = Depends(get_conn),
) -> list[dict]:
    mistakes = get_top_mistakes(conn, user["id"])
    return [
        {
            "id": f"{m['category']}-{i}",
            "category": m["category"],
            "original": m["original"],
            "correction": m["correction"],
            "count": m["count"],
        }
        for i, m in enumerate(mistakes)
    ]
