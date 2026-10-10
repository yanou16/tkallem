from datetime import date, timedelta
from uuid import uuid4

import pytest

from app.db.progress import combine_metrics, count_streak, get_activity, get_metrics
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


def metric_row(words=100, mistakes=None, answers=5, hesitations=None, speaking=None) -> dict:
    return {
        "session_id": uuid4(),
        "words": words,
        "mistakes_per_100": mistakes,
        "answers": answers,
        "hesitations_per_min": hesitations,
        "speaking_seconds": speaking,
    }


EMPTY_METRICS = {
    "mistakes_per_100": None,
    "words_per_answer": None,
    "hesitations_per_min": None,
    "speaking_seconds": None,
}


def test_combine_without_sessions_gives_no_numbers():
    assert combine_metrics([]) == EMPTY_METRICS


def test_combine_weights_mistakes_by_words():
    rows = [metric_row(words=100, mistakes=10), metric_row(words=300, mistakes=2)]

    assert combine_metrics(rows)["mistakes_per_100"] == pytest.approx(4.0)


def test_combine_divides_total_words_by_total_answers():
    rows = [metric_row(words=100, answers=10), metric_row(words=50, answers=0)]

    assert combine_metrics(rows)["words_per_answer"] == pytest.approx(15.0)


def test_combine_weights_hesitations_by_speaking_time():
    rows = [metric_row(hesitations=4, speaking=60), metric_row(hesitations=1, speaking=180)]

    metrics = combine_metrics(rows)

    assert metrics["hesitations_per_min"] == pytest.approx(1.75)
    assert metrics["speaking_seconds"] == pytest.approx(120)


def test_combine_text_sessions_have_no_voice_metrics():
    metrics = combine_metrics([metric_row(mistakes=5)])

    assert metrics["hesitations_per_min"] is None
    assert metrics["speaking_seconds"] is None


def add_finished(db, user_id: int, days_back: int, mistakes_per_100: float):
    sid = add_session(db, user_id, days_back, finished=False)
    db.execute(
        "INSERT INTO session_metrics (session_id, words, mistakes_per_100) VALUES (%s, %s, %s)",
        (sid, 50, mistakes_per_100),
    )


def test_metrics_for_a_new_user(db, user):
    assert get_metrics(db, user["id"]) == {"current": EMPTY_METRICS, "baseline": None}


def test_no_baseline_with_three_sessions_or_less(db, user):
    for days_back, mistakes in [(3, 6), (2, 4), (1, 2)]:
        add_finished(db, user["id"], days_back, mistakes)

    metrics = get_metrics(db, user["id"])

    assert metrics["baseline"] is None
    assert metrics["current"]["mistakes_per_100"] == pytest.approx(4)


def test_baseline_is_the_first_three_and_current_the_last_five(db, user):
    mistakes_by_age = [10, 10, 10, 20, 20, 4, 4, 4, 4, 4]
    for days_back, mistakes in zip(range(10, 0, -1), mistakes_by_age):
        add_finished(db, user["id"], days_back, mistakes)

    metrics = get_metrics(db, user["id"])

    assert metrics["baseline"]["mistakes_per_100"] == pytest.approx(10)
    assert metrics["current"]["mistakes_per_100"] == pytest.approx(4)


def test_unfinished_sessions_are_ignored_by_metrics(db, user):
    add_finished(db, user["id"], days_back=1, mistakes_per_100=3)
    add_session(db, user["id"], days_back=0, finished=False)

    assert get_metrics(db, user["id"])["current"]["mistakes_per_100"] == pytest.approx(3)