from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from tkallem_agent.schemas import ExplainLang


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