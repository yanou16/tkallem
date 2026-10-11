from typing import Literal

from pydantic import BaseModel
from tkallem_agent.scenarios import Category
from tkallem_agent.schemas import Level


class ScenarioSummary(BaseModel):
    id: str
    title: str
    description: str
    category: Category
    level: Level
    icon: str
    mode: Literal["guided", "free"]
    minutes: int | None
    total_questions: int | None  # null in free talk (no fixed questions)