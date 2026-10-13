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


class HintRequest(BaseModel):
    """"Help me start" (docs/JURY_BRIEF.md, improvement 1). `text`: the student's idea in French or Darija, for
    `translate` only."""
    model_config = ConfigDict(extra="forbid")

    type: Literal["starter", "translate"]
    text: str | None = Field(None, max_length=2000)


class HintResult(BaseModel):
    kind: Literal["starter", "translation"]  # a translation refused by the code comes back as the scenario's starter
    lines: list[str] = Field(min_length=1, max_length=2)  # starters are shown followed by "…"
    fallback: bool  # the scenario's own starter, because the model's suggestion was refused or failed
    remaining: int  # hints left for this question


class RepeatResult(BaseModel):
    """"Say it again" (docs/JURY_BRIEF.md, improvement 2): judged by code (tkallem_agent.repeat), never by the model."""
    nailed: bool
    heard: str  # what the transcription heard
    target: str  # the corrected sentence
    missing: list[str]  # corrected phrases not heard, or said with the mistake again
    similarity: float
    tries_left: int


class SessionStarted(BaseModel):
    session_id: str
    first_question: FirstQuestion

class TurnResult(BaseModel):
    transcript: str
    reply: str
    reply_audio_url: str | None = None
    corrections: list[Correction] = Field(max_length=3)
    sentence_status: Status
    praise: str | None = None  # improvement 4: one short true positive, checked by the agent's code
    priority_index: int = 0  # the correction shown in full; the others are folded
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
    progress: str | None = None  # first line of the report: progress since the last finished session, written by code


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
    praise: str | None = None  # improvement 4: shown before the corrections
    priority_index: int = 0  # the correction shown in full; the others are folded


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
    progress: str | None = None  # finished sessions: the report's first line