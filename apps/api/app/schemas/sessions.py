from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from tkallem_agent.schemas import Correction, ExplainLang, Status

from app.schemas.credits import Credits

class SessionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    scenario_id: str = Field(min_length=1, max_length=100)
    mode: Literal["text", "voice"] = "text"
    explain_lang: ExplainLang | None = None


class FirstQuestion(BaseModel):
    text: str
    audio_url: str | None = None


class Spoken(BaseModel):
    text: str
    audio_url: str | None = None  # None when every voice provider failed: the app uses the browser's voice


class SessionStarted(BaseModel):
    session_id: str
    first_question: FirstQuestion

class TurnResult(BaseModel):
    transcript: str
    reply: str
    reply_audio_url: str | None = None
    corrections: list[Correction] = Field(max_length=3)
    sentence_status: Status
    finished: bool
    credits: Credits | None = None  # balance after this answer


class ReportLine(BaseModel):
    role: Literal["coach", "student"]
    text: str
    status: Status | None = None
    corrections: list[Correction] = Field(default_factory=list)


class Metrics(BaseModel):
    mistakes_per_100: float | None
    words_per_answer: float | None
    hesitations_per_min: float | None
    speaking_seconds: float | None

class Levels(BaseModel):
    mistakes_per_100: Status | None
    words_per_answer: Status | None
    hesitations_per_min: Status | None


class SessionReport(BaseModel):
    lines: list[ReportLine]
    note: str
    metrics: Metrics
    levels: Levels
    redo_index: int | None


class SessionSummary(BaseModel):
    session_id: str
    scenario_id: str
    title: str
    started_at: datetime
    ended_at: datetime | None
    answered: int
    total_questions: int | None


class TurnDetail(BaseModel):
    position: int
    transcript: str
    reply: str
    sentence_status: Status
    corrections: list[Correction]


class SessionDetail(BaseModel):
    session_id: str
    scenario_id: str
    title: str
    mode: Literal["text", "voice"]
    started_at: datetime
    ended_at: datetime | None
    finished: bool
    total_questions: int | None
    first_question: str | None
    turns: list[TurnDetail]
    # What /end stored, null before. The rest of the report (levels, redo_index) is not stored.
    note: str | None
    metrics: Metrics | None