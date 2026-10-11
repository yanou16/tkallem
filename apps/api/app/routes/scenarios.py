from fastapi import APIRouter, Depends
from tkallem_agent import Scenario, list_scenarios

from app.schemas.scenarios import ScenarioSummary
from app.security import get_clerk_claims

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


# The token is checked, but no database connection is needed: scenarios are the same for every student.
@router.get("", response_model=list[ScenarioSummary], dependencies=[Depends(get_clerk_claims)])
def read_scenarios() -> list[dict]:
    return [_summary(scenario) for scenario in list_scenarios()]
