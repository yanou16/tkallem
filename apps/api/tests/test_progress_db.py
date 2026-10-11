from datetime import date, timedelta
from uuid import uuid4

import pytest

from app.db.progress import best_streak, combine_metrics, count_streak, get_activity, get_metrics, get_top_mistakes
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


def test_best_streak_is_zero_without_practice():
    assert best_streak([]) == 0


def test_best_streak_is_the_longest_run_ever():
    assert best_streak(days_ago(0, 10, 11, 12, 13, 20, 21)) == 4


def test_best_streak_keeps_a_run_that_is_over():
    days = days_ago(5, 6, 7)

    assert count_streak(days, TODAY) == 0
    assert best_streak(days) == 3


def test_best_streak_ignores_order_and_duplicates():
    assert best_streak(days_ago(2, 0, 1, 1)) == 3


@pytest.fixture
def user(db):
    return get_or_create_by_clerk_id(db, "user_progress_test")


def add_session(
    db,
    user_id: int,
    days_back: int,
    speaking_seconds: float | None = None,
    finished: bool = True,
    minutes: int | None = None,
):
    """`minutes`: the session ended that long after it started (ended_at is set)."""
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
    if minutes is not None:
        db.execute(
            "UPDATE practice_sessions SET ended_at = started_at + make_interval(mins => %s) WHERE id = %s",
            (minutes, sid),
        )
    return sid


def test_activity_is_empty_for_a_new_user(db, user):
    assert get_activity(db, user["id"]) == {"week_seconds": 0, "today_seconds": 0, "streak_days": 0}


def test_activity_sums_spoken_time_for_today_and_the_week(db, user):
    add_session(db, user["id"], days_back=0, speaking_seconds=60, minutes=5)
    add_session(db, user["id"], days_back=3, speaking_seconds=120, minutes=5)
    add_session(db, user["id"], days_back=10, speaking_seconds=300, minutes=10)

    activity = get_activity(db, user["id"])

    assert activity["today_seconds"] == pytest.approx(60)
    assert activity["week_seconds"] == pytest.approx(180)


def test_text_session_counts_its_length(db, user):
    add_session(db, user["id"], days_back=0, minutes=12)
    add_session(db, user["id"], days_back=2, minutes=5)

    activity = get_activity(db, user["id"])

    assert activity["today_seconds"] == pytest.approx(12 * 60)
    assert activity["week_seconds"] == pytest.approx(17 * 60)


def test_text_session_counts_thirty_minutes_at_most(db, user):
    add_session(db, user["id"], days_back=0, minutes=180)

    assert get_activity(db, user["id"])["today_seconds"] == pytest.approx(1800)


def test_spoken_time_wins_over_the_session_length(db, user):
    add_session(db, user["id"], days_back=0, speaking_seconds=90, minutes=20)

    assert get_activity(db, user["id"])["today_seconds"] == pytest.approx(90)


def test_unfinished_sessions_add_no_practice_time(db, user):
    add_session(db, user["id"], days_back=0, finished=False)

    assert get_activity(db, user["id"])["today_seconds"] == 0


def test_text_time_needs_an_end_time(db, user):
    # Metrics without ended_at: LEAST would ignore the missing length and count 30 minutes.
    add_session(db, user["id"], days_back=0, speaking_seconds=None)

    assert get_activity(db, user["id"])["today_seconds"] == 0


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


def add_correction(db, session_id, category: str, original: str, rule: str | None = None):
    """`category` is the correction type (grammar...); `rule` the optional fine-grained category."""
    turn = db.execute(
        """
        INSERT INTO turns (session_id, position, transcript, reply, sentence_status)
        VALUES (%s, (SELECT COALESCE(MAX(position), 0) + 1 FROM turns WHERE session_id = %s), 'answer', 'reply', 'red')
        RETURNING id
        """,
        (session_id, session_id),
    ).fetchone()
    db.execute(
        "INSERT INTO corrections (turn_id, original, fixed, type, why, rule) VALUES (%s, %s, %s, %s, 'because', %s)",
        (turn["id"], original, f"{original} fixed", category, rule),
    )


def test_top_mistakes_empty_for_a_new_user(db, user):
    assert get_top_mistakes(db, user["id"]) == []


def test_top_mistakes_are_grouped_counted_with_latest_example(db, user):
    sid = add_session(db, user["id"], days_back=0, finished=False)
    for category, original in [
        ("grammar", "g1"), ("word_choice", "w1"), ("grammar", "g2"),
        ("vocabulary", "v1"), ("word_choice", "w2"), ("grammar", "g3"),
    ]:
        add_correction(db, sid, category, original)

    assert get_top_mistakes(db, user["id"]) == [
        {"category": "grammar", "original": "g3", "correction": "g3 fixed", "count": 3},
        {"category": "word_choice", "original": "w2", "correction": "w2 fixed", "count": 2},
        {"category": "vocabulary", "original": "v1", "correction": "v1 fixed", "count": 1},
    ]


def test_top_mistakes_keeps_three_categories(db, user):
    sid = add_session(db, user["id"], days_back=0, finished=False)
    for category in ["word_choice", "vocabulary", "other", "grammar"]:
        add_correction(db, sid, category, category)

    categories = [m["category"] for m in get_top_mistakes(db, user["id"])]

    assert categories == ["grammar", "other", "vocabulary"]


def test_top_mistakes_only_looks_at_the_last_five_sessions(db, user):
    old = add_session(db, user["id"], days_back=10, finished=False)
    add_correction(db, old, "grammar", "old mistake")
    for days_back in range(5, 0, -1):
        sid = add_session(db, user["id"], days_back, finished=False)
        add_correction(db, sid, "vocabulary", f"v{days_back}")

    assert [(m["category"], m["count"]) for m in get_top_mistakes(db, user["id"])] == [("vocabulary", 5)]


def test_top_mistakes_ignores_other_users(db, user):
    other = get_or_create_by_clerk_id(db, "user_progress_other")
    sid = add_session(db, other["id"], days_back=0, finished=False)
    add_correction(db, sid, "grammar", "not yours")

    assert get_top_mistakes(db, user["id"]) == []


def categories_and_counts(db, user) -> list[tuple[str, int]]:
    return [(m["category"], m["count"]) for m in get_top_mistakes(db, user["id"])]


def test_top_mistakes_are_grouped_by_rule(db, user):
    sid = add_session(db, user["id"], days_back=0, finished=False)
    add_correction(db, sid, "grammar", "I go yesterday", rule="verb_tense")
    add_correction(db, sid, "grammar", "she go", rule="subject_verb_agreement")
    add_correction(db, sid, "grammar", "I have went", rule="verb_tense")

    assert get_top_mistakes(db, user["id"])[0] == {
        "category": "verb_tense", "original": "I have went", "correction": "I have went fixed", "count": 2,
    }
    assert categories_and_counts(db, user) == [("verb_tense", 2), ("subject_verb_agreement", 1)]


def test_top_mistakes_fall_back_to_the_type_without_rule(db, user):
    sid = add_session(db, user["id"], days_back=0, finished=False)
    add_correction(db, sid, "vocabulary", "a big fault", rule=None)

    assert categories_and_counts(db, user) == [("vocabulary", 1)]


def test_top_mistakes_fall_back_to_the_type_when_the_rule_is_other(db, user):
    sid = add_session(db, user["id"], days_back=0, finished=False)
    add_correction(db, sid, "word_choice", "make a photo", rule="other")
    add_correction(db, sid, "word_choice", "do a mistake")

    assert categories_and_counts(db, user) == [("word_choice", 2)]


def test_old_corrections_without_rule_are_still_shown(db, user):
    old = add_session(db, user["id"], days_back=2, finished=False)
    add_correction(db, old, "grammar", "old one")
    add_correction(db, old, "grammar", "old two")
    new = add_session(db, user["id"], days_back=0, finished=False)
    add_correction(db, new, "grammar", "for study", rule="preposition")

    assert categories_and_counts(db, user) == [("grammar", 2), ("preposition", 1)]