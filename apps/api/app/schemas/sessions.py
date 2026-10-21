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
    # "practice": corrections after each answer, hints and Say it again. "interview": the coach plays the real officer and
    # nothing is shown until the report (docs/JURY_BRIEF.md, improvement 3).
    feedback_mode: Literal["practice", "interview"] = "practice"


class FirstQuestion(BaseModel):
    text: str
    audio_url: str | None = None


class Spoken(BaseModel):
    text: str
    audio_url: str | None = None  # None when every voice provider failed: the app uses the browser's voice


class NoteRequest(BaseModel):
    """The report's coach note, written again in the other language ("Explain in English / French")."""
    model_config = ConfigDict(extra="forbid")

    lang: ExplainLang


class NoteResult(BaseModel):
    note: str
    explain_lang: ExplainLang


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
    feedback_mode: Literal["practice", "interview"] = "practice"

class TurnResult(BaseModel):
    transcript: str
    reply: str
    reply_audio_url: str | None = None
    corrections: list[Correction] = Field(max_length=3)
    sentence_status: Status | None  # None in a real interview: corrections are kept for the report
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


class ConfidenceAnswer(BaseModel):
    """"How confident do you feel about this interview?", 1 (not at all) to 5 (very), before the first answer or after the
    report. Skippable: the app simply does not send it."""
    model_config = ConfigDict(extra="forbid")

    when: Literal["before", "after"]
    value: int = Field(ge=1, le=5)


class Confidence(BaseModel):
    before: int | None = None
    after: int | None = None


class Freeze(BaseModel):
    """Freeze meter: average seconds between the end of the coach's question and the first sound or letter."""
    seconds: float
    answers: int
    kind: Literal["voice", "text", "mixed"]
    previous: float | None = None  # the last finished session's, only when the same kind of answers


class VerdictReason(BaseModel):
    metric: Literal["mistakes_per_100", "words_per_answer", "hesitations_per_min"]
    level: Status
    value: float


class Verdict(BaseModel):
    """Real interview only: ready / almost / not yet for THIS practice, with the two metrics that explain it."""
    status: Literal["ready", "almost", "not_yet"]
    reasons: list[VerdictReason]


class SessionReport(BaseModel):
    lines: list[ReportLine]
    note: str
    metrics: Metrics
    levels: Levels
    redo_index: int | None
    confidence: Confidence | None = None  # the student's own 1-to-5 answers, before and after
    feedback_mode: Literal["practice", "interview"] = "practice"
    progress: str | None = None  # first line of the report: progress since the last finished session, written by code
    freeze: Freeze | None = None  # time before starting to answer, with the previous session's when comparable
    verdict: Verdict | None = None  # real interview with at least 3 answers, computed by code (app/verdict.py)


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
    sentence_status: Status | None  # None while a real interview runs: nothing is shown before the report
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
    confidence: Confidence | None = None
    feedback_mode: Literal["practice", "interview"] = "practice"
    progress: str | None = None  # finished sessions: the report's first line
    freeze: Freeze | None = None
    verdict: Verdict | None = None  # finished real interviews: derived from the stored metrics