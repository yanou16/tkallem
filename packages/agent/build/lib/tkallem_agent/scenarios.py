"""Scenario files (JSON, versioned in Git, reviewed by the team). The agent is their only reader: the API lists them
with `list_scenarios()` and starts sessions with `load_scenario(id)`."""
import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

SCENARIOS_DIR = Path(os.getenv("TKALLEM_SCENARIOS_DIR", Path(__file__).parent / "scenarios"))


class Scenario(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^[a-z0-9-]+$")
    title: str
    mode: Literal["guided", "free"] = "guided"
    minutes: int | None = None  # shown on the scenario card
    coach_role: str
    opening: str | None = None  # free mode: first coach line (guided mode starts with questions[0])
    questions: list[str] = []
    goals: list[str] = []
    useful_words: list[str] = []

    @model_validator(mode="after")
    def coherent(self):
        if self.mode == "guided":
            if not self.questions:
                raise ValueError("a guided scenario needs questions")
            if len(self.goals) != len(self.questions):
                raise ValueError("one goal id per question")
            if len(set(self.goals)) != len(self.goals):
                raise ValueError("goal ids must be unique")
        else:
            if self.questions or self.goals:
                raise ValueError("a free scenario has no fixed questions or goals")
            if not self.opening:
                raise ValueError("a free scenario needs an opening line")
        return self

    @property
    def first_line(self) -> str:
        return self.questions[0] if self.mode == "guided" else self.opening  # type: ignore[return-value]


class ScenarioNotFound(LookupError):
    pass


@lru_cache
def list_scenarios() -> tuple[Scenario, ...]:
    out = []
    for f in sorted(SCENARIOS_DIR.glob("*.json")):
        s = Scenario.model_validate(json.loads(f.read_text()))
        if s.id != f.stem:
            raise ValueError(f"{f.name}: id {s.id!r} must match the file name")
        out.append(s)
    return tuple(out)


def load_scenario(scenario_id: str) -> Scenario:
    for s in list_scenarios():
        if s.id == scenario_id:
            return s
    raise ScenarioNotFound(scenario_id)
