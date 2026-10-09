from pydantic import BaseModel
from app.schemas.enums import Level, ScenarioCategory


class ScenarioItem(BaseModel):
    id: str
    title: str
    subtitle: str | None = None
    description: str
    duration: int
    level: Level
    category: ScenarioCategory
    icon: str


class RecentSessionItem(BaseModel):
    id: str
    scenarioId: str
    title: str
    subtitle: str
    duration: int
    level: Level
    icon: str


class PracticeFocusItem(BaseModel):
    scenarioId: str | None = None
    title: str
    description: str
    reason: str
    icon: str
