"""Scenario files (JSON, versioned in Git, reviewed by the team). The agent is their only reader: the API lists them
with `list_scenarios()` and starts sessions with `load_scenario(id)`."""
import json
import logging
import os
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from .schemas import Level

Category = Literal["travel", "study", "work", "exams", "speaking"]

logger = logging.getLogger(__name__)
SCENARIOS_DIR = Path(os.getenv("TKALLEM_SCENARIOS_DIR", Path(__file__).parent / "scenarios"))


class Scenario(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^[a-z0-9-]+$")
    title: str
    # Card shown on the Practice screen (GET /scenarios). `category` and `icon` values are agreed with the front.
    description: str = Field(min_length=10, max_length=160)  # one sentence
    category: Category
    level: Level  # recommended level, same values as users.level
    icon: str = Field(pattern=r"^[a-z]+$")  # an identifier from apps/web/src/lib/icons.tsx
    mode: Literal["guided", "free"] = "guided"
    minutes: int = Field(gt=0)  # duration shown on the card (suggested duration for free talk)
    coach_role: str
    opening: str | None = None  # free mode: first coach line (guided mode starts with questions[0])
    questions: list[str] = []
    goals: list[str] = []
    useful_words: list[str] = []
    skippable: list[str] = []  # goal ids the coach may skip when the student's answer makes them meaningless

    @model_validator(mode="after")
    def coherent(self):
        if self.mode == "guided":
            if not self.questions:
                raise ValueError("a guided scenario needs questions")
            if len(self.goals) != len(self.questions):
                raise ValueError("one goal id per question")
            if len(set(self.goals)) != len(self.goals):
                raise ValueError("goal ids must be unique")
            if self.goals and self.goals[0] in self.skippable:
                raise ValueError("the first question cannot be skipped")
            if not set(self.skippable) <= set(self.goals):
                raise ValueError("skippable ids must be goal ids")
        else:
            if self.skippable:
                raise ValueError("a free scenario has nothing to skip")
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


def read_scenario(path: Path) -> Scenario:
    s = Scenario.model_validate(json.loads(path.read_text()))
    if s.id != path.stem:
        raise ValueError(f"{path.name}: id {s.id!r} must match the file name")
    return s


@lru_cache
def list_scenarios() -> tuple[Scenario, ...]:
    """Valid scenarios, sorted by id (the file name is the id). A broken file is logged and skipped, so one bad file does not take every scenario down
    (pytest validates all files strictly, see tests/test_scenarios.py)."""
    out = []
    for f in sorted(SCENARIOS_DIR.glob("*.json")):
        try:
            out.append(read_scenario(f))
        except (ValueError, OSError) as e:
            logger.error("skipping scenario %s: %s", f.name, e)
    if not out:
        logger.error("no scenario found in %s", SCENARIOS_DIR)
    return tuple(out)


def load_scenario(scenario_id: str) -> Scenario:
    for s in list_scenarios():
        if s.id == scenario_id:
            return s
    raise ScenarioNotFound(scenario_id)
