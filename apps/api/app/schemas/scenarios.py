from typing import Literal

from pydantic import BaseModel


class ScenarioSummary(BaseModel):
    id: str
    title: str
    mode: Literal["guided", "free"]
    minutes: int | None
    total_questions: int | None  # null in free talk (no fixed questions)
    # Not in the agent's scenario files yet (Rayane will add them): always null for now.
    description: str | None = None
    category: str | None = None
    level: str | None = None
    icon: str | None = None
