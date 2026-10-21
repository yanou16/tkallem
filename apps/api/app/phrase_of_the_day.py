"""Phrase of the day: one English phrase a day, explained in French, that the student says out loud.

No database and no cron: today's phrase is picked from a fixed list by the date in Algiers (UTC+1, no daylight saving
since 1981), so every student sees the same phrase and a restart changes nothing. The list is original text written for
Tkallem (app/data/daily_phrases.json): mostly phrases that help in an interview, an idiom now and then, never twice in a row.

The check is done by code, like "Say it again": the server transcribes the recording, then compares it with TODAY's phrase
(the client never says which phrase it speaks, so it cannot ask for another one).
"""
import json
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ALGIERS = timezone(timedelta(hours=1))
FIRST_DAY = date(2026, 10, 29)  # the list starts here (the internal deadline): the first three days are interview phrases
PHRASES: list[dict] = json.loads((Path(__file__).parent / "data" / "daily_phrases.json").read_text(encoding="utf-8"))


def algiers_today(now: datetime | None = None) -> date:
    return (now or datetime.now(timezone.utc)).astimezone(ALGIERS).date()


def phrase_for(day: date) -> dict:
    """The phrase of `day`: the list in order from FIRST_DAY, then again from the start (and backwards before it)."""
    return PHRASES[(day - FIRST_DAY).days % len(PHRASES)]
