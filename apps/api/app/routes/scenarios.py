"""Scenario cards for the Practice and AI Chat screens (public: no account needed to see what exists)."""
from fastapi import APIRouter
from tkallem_agent import list_scenarios

router = APIRouter(tags=["scenarios"])


@router.get("/scenarios")
def scenarios(category: str | None = None) -> list[dict]:
    return [
        {
            "id": s.id,
            "title": s.title,
            "description": s.description,
            "duration": s.minutes,
            "level": s.level,
            "category": s.category,
            "icon": s.icon,
            "mode": s.mode,
        }
        for s in list_scenarios()
        if category in (None, s.category)
    ]
