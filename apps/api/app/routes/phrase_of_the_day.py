"""Phrase of the day (app/phrase_of_the_day.py): read it, and say it. Free: no credit, no session, nothing stored."""
import logging

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from tkallem_agent.repeat import match_repeat

from app import rate_limit
from app.config import settings
from app.dependencies import get_current_user
from app.phrase_of_the_day import algiers_today, phrase_for
from app.schemas.phrase import PhraseChecked, PhraseOfTheDay
from app.voice import SttError, transcribe

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/phrase-of-the-day", tags=["phrase-of-the-day"])


@router.get("", response_model=PhraseOfTheDay)
def read_phrase_of_the_day() -> dict:
    """Open to everyone, with no account and no guest: it is a text from a fixed list."""
    today = algiers_today()
    return {"date": today, **phrase_for(today)}


@router.post("/check", response_model=PhraseChecked)
def check_phrase_of_the_day(audio: UploadFile = File(...), user: dict = Depends(get_current_user)) -> dict:
    """The student says TODAY's phrase. The server transcribes the recording and the code compares it with the phrase
    (tkallem_agent.repeat): the client does not say which phrase it speaks. Guests may try. Limited per student."""
    if not rate_limit.phrase_checks.allow(str(user["id"])):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many tries in the last hour: take a break and come back")
    data = audio.file.read(settings.max_audio_bytes + 1)
    if len(data) > settings.max_audio_bytes:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, "Recording too long: say only the phrase")
    try:
        heard = transcribe(data, audio.filename or "phrase.webm", audio.content_type or "audio/webm")
    except SttError as exc:
        logger.warning("Phrase of the day, transcription failed: %s", exc)
        if exc.bad_audio:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "We could not read this recording, try again")
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Speech recognition is unavailable, try again later")
    if not any(c.isalpha() for c in heard.text):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "We did not hear anything, try again")
    if heard.unclear:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "We could not understand this recording, speak a little closer and try again")
    result = match_repeat(phrase_for(algiers_today())["text"], [], heard.text)
    return {**result.model_dump(), "heard": heard.text}
