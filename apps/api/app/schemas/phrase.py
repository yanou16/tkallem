from datetime import date
from typing import Literal

from pydantic import BaseModel


class PhraseOfTheDay(BaseModel):
    """Today's phrase (date in Algiers). `fr` and `en` explain it; `example` shows it in a sentence."""
    date: date
    id: str
    kind: Literal["interview", "everyday", "idiom"]
    text: str
    fr: str
    en: str
    example: str


class PhraseChecked(BaseModel):
    """What the code decided about the recording: the same shape as "Say it again", plus what was heard."""
    nailed: bool
    similarity: float
    missing: list[str]
    target: str
    heard: str
