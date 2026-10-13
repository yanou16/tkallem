from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator
from tkallem_agent.schemas import ErrorType, Level

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


class CheckRequest(BaseModel):
    """A draft checked privately before sending it (same length as a message)."""
    model_config = ConfigDict(extra="forbid")

    text: str

    @field_validator("text")
    @classmethod
    def trimmed_text(cls, value: str) -> str:
        value = value.strip()
        if not 1 <= len(value) <= MESSAGE_MAX:
            raise ValueError(f"a text to check has 1 to {MESSAGE_MAX} characters")
        return value


class CheckedCorrection(BaseModel):
    original: str
    correction: str
    explanation: str  # in the student's explanation language (profile)
    type: ErrorType  # grammar, vocabulary, word_choice or other: the label to show when there is no rule
    rule: str | None  # fine-grained category (verb_tense...), null when the model gave none


class LeaderboardEntry(BaseModel):
    rank: int  # 1 = most practice this week; equal practice time and streak share the same rank
    member: GroupMember
    week_seconds: float  # practice time over the last 7 days, as in GET /me/progress (seconds, like every time)
    streak_days: int  # current streak of practice days
    is_me: bool
