"""The phrase of the day is chosen by the date in Algiers and the list is sound (app/phrase_of_the_day.py)."""
from datetime import date, datetime, timedelta, timezone

from app.phrase_of_the_day import FIRST_DAY, PHRASES, algiers_today, phrase_for
from tkallem_agent.repeat import normalize


def test_the_list_is_sound():
    assert len(PHRASES) >= 40  # more than a month before it starts again
    assert len({p["id"] for p in PHRASES}) == len(PHRASES)
    assert len({p["text"] for p in PHRASES}) == len(PHRASES)
    for p in PHRASES:
        assert set(p) == {"id", "kind", "text", "fr", "en", "example"}, p["id"]
        assert p["kind"] == "idiom" and all(str(p[k]).strip() for k in p), p["id"]
        assert 4 <= len(normalize(p["text"])) <= 14, p["id"]  # long enough to mean something, short enough to say in one go


def test_it_is_an_idiom_of_the_day_and_each_idiom_is_explained_in_french_and_in_english():
    for p in PHRASES:
        assert p["kind"] == "idiom", p["id"]
        assert p["fr"] != p["en"] and p["example"] != p["text"], p["id"]
        assert any(c in p["fr"] for c in "éèêàçùôîâ'") or len(p["fr"]) > 25, p["id"]  # written in French, not copied from the English one


def test_the_first_idiom_is_the_famous_one_and_the_jury_week_has_no_repeat():
    assert PHRASES[0]["id"] == "raining-cats"
    week = [phrase_for(FIRST_DAY + timedelta(days=i))["id"] for i in range(10)]  # 29 October to 7 November
    assert len(set(week)) == 10


def test_the_same_day_gives_the_same_phrase_and_the_list_goes_round():
    assert phrase_for(FIRST_DAY) == PHRASES[0]
    assert phrase_for(date(2026, 10, 30)) == PHRASES[1]
    assert phrase_for(FIRST_DAY + timedelta(days=len(PHRASES))) == PHRASES[0]
    assert phrase_for(FIRST_DAY - timedelta(days=1)) == PHRASES[-1]  # before the start it still works


def test_the_day_changes_at_midnight_in_algiers_not_in_utc():
    # 23:30 UTC on 29 Oct is already 00:30 on 30 Oct in Algiers (UTC+1)
    assert algiers_today(datetime(2026, 10, 29, 22, 59, tzinfo=timezone.utc)) == date(2026, 10, 29)
    assert algiers_today(datetime(2026, 10, 29, 23, 0, tzinfo=timezone.utc)) == date(2026, 10, 30)
    assert algiers_today(datetime(2026, 10, 29, 23, 30, tzinfo=timezone.utc)) == date(2026, 10, 30)
