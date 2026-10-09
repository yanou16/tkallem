import logging
from fastapi import APIRouter, Depends, Query
from psycopg import Connection
from tkallem_agent import list_scenarios

from app.db.connection import get_conn
from app.db.sessions import get_recent_practice_sessions
from app.dependencies import get_current_user
from app.schemas.enums import Level, ScenarioCategory
from app.schemas.practice import (
    PracticeFocusItem,
    RecentSessionItem,
    ScenarioItem,
)

router = APIRouter(prefix="/api/practice", tags=["practice"])
logger = logging.getLogger(__name__)

SCENARIO_METADATA = {
    "visa-us": {
        "subtitle": "US Embassy visa interview",
        "description": "Practice answering consular officer questions clearly and confidently.",
        "duration": 8,
        "level": Level.B1,
        "category": ScenarioCategory.TRAVEL,
        "icon": "plane",
    },
    "campus-france": {
        "subtitle": "Campus France interview",
        "description": "Present your study project and career plans clearly in English.",
        "duration": 8,
        "level": Level.B1,
        "category": ScenarioCategory.EXAMS,
        "icon": "university",
    },
    "job-remote": {
        "subtitle": "Remote software job interview",
        "description": "Talk about your background, previous projects, and teamwork.",
        "duration": 10,
        "level": Level.B2,
        "category": ScenarioCategory.WORK,
        "icon": "briefcase",
    },
    "ielts-part2": {
        "subtitle": "IELTS Speaking Part 2",
        "description": "Speak continuously on a cue card topic for 2 minutes.",
        "duration": 5,
        "level": Level.B2,
        "category": ScenarioCategory.EXAMS,
        "icon": "exam",
    },
    "free-talk": {
        "subtitle": "Casual conversation",
        "description": "Open-ended speaking practice on any topic with your coach.",
        "duration": 5,
        "level": Level.A2,
        "category": ScenarioCategory.SPEAKING,
        "icon": "chat",
    },
}


def _enrich_scenario(s) -> ScenarioItem:
    meta = SCENARIO_METADATA.get(
        s.id,
        {
            "subtitle": None,
            "description": s.coach_role,
            "duration": s.minutes or 5,
            "level": Level.B1,
            "category": ScenarioCategory.SPEAKING,
            "icon": "chat",
        },
    )
    return ScenarioItem(
        id=s.id,
        title=s.title,
        subtitle=meta["subtitle"],
        description=meta["description"],
        duration=s.minutes or meta["duration"],
        level=meta["level"],
        category=meta["category"],
        icon=meta["icon"],
    )


@router.get("/scenarios", response_model=list[ScenarioItem])
def get_scenarios(category: ScenarioCategory | None = Query(None)) -> list[ScenarioItem]:
    all_scenarios = [_enrich_scenario(s) for s in list_scenarios()]
    if category:
        return [s for s in all_scenarios if s.category == category]
    return all_scenarios


@router.get("/sessions/recent", response_model=list[RecentSessionItem])
def get_recent_sessions(
    user: dict = Depends(get_current_user),
    conn: Connection | None = Depends(get_conn),
) -> list[RecentSessionItem]:
    recent_rows = get_recent_practice_sessions(conn, user["id"], limit=5)
    out = []
    for r in recent_rows:
        meta = SCENARIO_METADATA.get(
            r["scenario_id"],
            {"subtitle": "Speaking session", "icon": "chat", "level": Level.B1},
        )
        duration = round(float(r.get("speaking_seconds", 0.0)) / 60.0) or 5
        out.append(
            RecentSessionItem(
                id=str(r["id"]),
                scenarioId=r["scenario_id"],
                title=r["scenario_id"].replace("-", " ").title(),
                subtitle=meta["subtitle"],
                duration=duration,
                level=meta["level"],
                icon=meta["icon"],
            )
        )
    return out


@router.get("/recommended", response_model=list[ScenarioItem])
def get_recommended_scenarios(
    user: dict = Depends(get_current_user),
) -> list[ScenarioItem]:
    scenarios = [_enrich_scenario(s) for s in list_scenarios()]
    user_level = user.get("level")
    if user_level:
        matching = [s for s in scenarios if s.level == user_level]
        if matching:
            return matching
    return scenarios[:2]


@router.get("/focus", response_model=PracticeFocusItem | None)
def get_practice_focus() -> PracticeFocusItem:
    return PracticeFocusItem(
        scenarioId="visa-us",
        title="Fluency & Confidence",
        description="Focus on speaking in complete sentences without long hesitations.",
        reason="Consistently practicing 5 minutes a day doubles retention.",
        icon="target",
    )
