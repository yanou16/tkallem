from fastapi import APIRouter
from tkallem_agent import Scenario, list_scenarios

from app.schemas.scenarios import ScenarioSummary

router = APIRouter(prefix="/scenarios", tags=["scenarios"])


def _summary(scenario: Scenario) -> dict:
    return {
        "id": scenario.id,
        "title": scenario.title,
        "description": scenario.description,
        "category": scenario.category,
        "level": scenario.level,
        "icon": scenario.icon,
        "mode": scenario.mode,
        "minutes": scenario.minutes,
        "total_questions": len(scenario.questions) if scenario.mode == "guided" else None,
    }


# Public: the welcome page lists them before any account or guest exists. No database: they are the same for everyone.
@router.get("", response_model=list[ScenarioSummary])
def read_scenarios() -> list[dict]:
    return [_summary(scenario) for scenario in list_scenarios()]
