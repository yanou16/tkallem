from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator
from tkallem_agent.schemas import Level

MESSAGE_MAX = 500
ThemeCategory = Literal["travel", "work", "study", "exams", "daily_life"]


class GroupThemeFile(BaseModel):
    """One theme of app/data/group_themes.json: one question per day, Monday first."""
    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^[a-z0-9-]+$")
    title: str = Field(min_length=1)
    category: ThemeCategory
    questions: list[str] = Field(min_length=7, max_length=7)


class Theme(BaseModel):
    id: str
    title: str
    category: ThemeCategory


class ThemeOfTheDay(Theme):
    question: str  # the question of the day, from the theme of the week


class GroupSummary(BaseModel):
    id: int
    name: str
    level: Level
    member_count: int
    last_activity: datetime | None  # the last visible message, null when nobody wrote yet
    theme: Theme  # the theme of the week, the same for every group


class GroupMember(BaseModel):
    id: int
    first_name: str | None


class GroupDetail(BaseModel):
    id: int
    name: str
    level: Level
    members: list[GroupMember]
    theme: ThemeOfTheDay


class Author(BaseModel):
    id: int
    first_name: str | None


class GroupMessage(BaseModel):
    id: int
    body: str
    created_at: datetime
    author: Author
    author_left: bool  # the author is no longer in the group (former member)


class MessageCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    body: str

    @field_validator("body")
    @classmethod
    def plain_trimmed_text(cls, value: str) -> str:
        value = value.strip()
        if not 1 <= len(value) <= MESSAGE_MAX:
            raise ValueError(f"a message has 1 to {MESSAGE_MAX} characters")
        return value


class ReportCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: Literal["insult", "harassment", "spam", "other"]


class ReportResult(BaseModel):
    hidden: bool  # this report was the one that hid the message for the whole group
