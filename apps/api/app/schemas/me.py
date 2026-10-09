from pydantic import BaseModel, ConfigDict, model_validator
from app.schemas.enums import ExplainLang, Level


class Me(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    avatar_url: str | None = None
    bio: str | None = None
    learning_goal: str | None = None
    daily_goal_minutes: int | None = 15
    preferred_practice_mode: str | None = "text"
    focus_areas: list[str] | None = None
    learning_languages: list[dict] | None = None
    level: Level | None = None
    explain_lang: ExplainLang = ExplainLang.FR


class MeUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    first_name: str | None = None
    last_name: str | None = None
    avatar_url: str | None = None
    bio: str | None = None
    learning_goal: str | None = None
    daily_goal_minutes: int | None = None
    preferred_practice_mode: str | None = None
    focus_areas: list[str] | None = None
    level: Level | None = None
    explain_lang: ExplainLang | None = None

    @model_validator(mode="after")
    def check_fields(self):
        if not self.model_fields_set:
            raise ValueError("send at least one field")
        return self

    def changes(self) -> dict:
        return self.model_dump(exclude_unset=True)