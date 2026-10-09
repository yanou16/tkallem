from pydantic import BaseModel, ConfigDict, Field
from app.schemas.enums import CorrectionType, ExplainLang, PracticeMode, SentenceStatus


class StartSessionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    scenario_id: str
    mode: PracticeMode = PracticeMode.TEXT
    explain_lang: ExplainLang = ExplainLang.FR


class FirstQuestion(BaseModel):
    text: str
    audio_url: str | None = None


class StartSessionResponse(BaseModel):
    session_id: str
    first_question: FirstQuestion


class CorrectionSchema(BaseModel):
    original: str
    fixed: str
    type: CorrectionType
    why: str


class TurnResponse(BaseModel):
    transcript: str
    reply: str
    reply_audio_url: str | None = None
    corrections: list[CorrectionSchema]
    sentence_status: SentenceStatus


class EndSessionReport(BaseModel):
    lines: list[dict]
    note: str
    metrics: dict
