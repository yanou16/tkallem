from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from tkallem_agent.schemas import Correction, ExplainLang, Status


class SessionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    scenario_id: str = Field(min_length=1, max_length=100)
    mode: Literal["text", "voice"] = "text"
    explain_lang: ExplainLang | None = None


class FirstQuestion(BaseModel):
    text: str
    audio_url: str | None = None


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