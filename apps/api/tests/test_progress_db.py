from datetime import date, timedelta
from uuid import uuid4

import pytest

from app.db.progress import count_streak, get_activity
from app.db.sessions import create_session
from app.db.users import get_or_create_by_clerk_id

TODAY = date(2026, 10, 10)
STATE = {"turns": [], "level": "B1"}


def days_ago(*offsets: int) -> list[date]:
    return [TODAY - timedelta(days=n) for n in offsets]


def test_streak_is_zero_without_practice():
    assert count_streak([], TODAY) == 0


def test_streak_counts_today_and_previous_days():
    assert count_streak(days_ago(0, 1, 2), TODAY) == 3


def test_streak_survives_until_today_is_over():
    assert count_streak(days_ago(1, 2), TODAY) == 2


def test_streak_is_lost_after_a_full_day_without_practice():
    assert count_streak(days_ago(2, 3, 4), TODAY) == 0


def test_streak_stops_at_the_first_gap():
    assert count_streak(days_ago(0, 1, 3, 4, 5), TODAY) == 2


def test_streak_ignores_duplicate_days():
    assert count_streak(days_ago(0, 0, 1), TODAY) == 2


@pytest.fixture
def user(db):
    return get_or_create_by_clerk_id(db, "user_progress_test")


def add_session(db, user_id: int, days_back: int, speaking_seconds: float | None = None, finished: bool = True):
    sid = uuid4()
    create_session(db, sid, user_id, "visa-us", "text", "fr", STATE)
    db.execute(
        "UPDATE practice_sessions SET started_at = now() - make_interval(days => %s) WHERE id = %s",
        (days_back, sid),
    )
    if finished:
        db.execute(
            "INSERT INTO session_metrics (session_id, words, speaking_seconds) VALUES (%s, %s, %s)",
            (sid, 50, speaking_seconds),
        )
    return sid


def test_activity_is_empty_for_a_new_user(db, user):
    assert get_activity(db, user["id"]) == {"week_seconds": 0, "today_seconds": 0, "streak_days": 0}


def test_activity_sums_speaking_time_for_today_and_the_week(db, user):
    add_session(db, user["id"], days_back=0, speaking_seconds=60)
    add_session(db, user["id"], days_back=3, speaking_seconds=120)
    add_session(db, user["id"], days_back=10, speaking_seconds=300)
    add_session(db, user["id"], days_back=0, speaking_seconds=None)

    activity = get_activity(db, user["id"])

    assert activity["today_seconds"] == pytest.approx(60)
    assert activity["week_seconds"] == pytest.approx(180)


def test_unfinished_sessions_count_for_the_streak(db, user):
    add_session(db, user["id"], days_back=0, finished=False)
    add_session(db, user["id"], days_back=1)
    add_session(db, user["id"], days_back=3)

    assert get_activity(db, user["id"])["streak_days"] == 2


def test_activity_ignores_other_users(db, user):
    other = get_or_create_by_clerk_id(db, "user_progress_other")
    add_session(db, other["id"], days_back=0, speaking_seconds=90)

    assert get_activity(db, user["id"]) == {"week_seconds": 0, "today_seconds": 0, "streak_days": 0}