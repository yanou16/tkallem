from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from tkallem_agent.schemas import ExplainLang, Level

DailyGoal = Literal[5, 10, 15, 20, 30]
FocusArea = Literal["conversation", "pronunciation", "vocabulary", "grammar", "fluency", "confidence"]
NULLABLE_FIELDS = {"first_name", "learning_goal", "practice_mode"}
FIRST_NAME_MAX = 50


class Me(BaseModel):
    first_name: str | None
    level: Level | None
    explain_lang: ExplainLang
    is_guest: bool = False  # visitor without account (Authorization: Guest ...)
    daily_goal_minutes: DailyGoal
    learning_goal: str | None
    practice_mode: str | None
    focus_areas: list[FocusArea]


class MeUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # Shown to the other members of a practice group. The name lives in Clerk: the app sends it here; null clears it.
    first_name: str | None = None
    level: Level | None = None
    explain_lang: ExplainLang | None = None
    daily_goal_minutes: DailyGoal | None = None
    learning_goal: str | None = Field(None, max_length=200)
    practice_mode: str | None = Field(None, max_length=200)
    focus_areas: list[FocusArea] | None = None

    @field_validator("first_name")
    @classmethod
    def trimmed_first_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not 1 <= len(value) <= FIRST_NAME_MAX:
            raise ValueError(f"first_name must have 1 to {FIRST_NAME_MAX} characters (null clears it)")
        return value

    @field_validator("learning_goal", "practice_mode")
    @classmethod
    def blank_means_empty(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None

    @field_validator("focus_areas")
    @classmethod
    def remove_duplicates(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        return list(dict.fromkeys(value))

    @model_validator(mode="after")
    def check_fields(self):
        if not self.model_fields_set:
            raise ValueError("send at least one field")
        for name in self.model_fields_set - NULLABLE_FIELDS:
            if getattr(self, name) is None:
                raise ValueError(f"{name} cannot be null")
        return self

    def changes(self) -> dict:
        return self.model_dump(exclude_unset=True)