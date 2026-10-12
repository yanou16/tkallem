from datetime import date, timedelta

from app.routes.groups import THEMES_EPOCH, load_themes, theme_of_the_day

MONDAY = THEMES_EPOCH


def test_the_file_has_8_themes_of_7_questions_with_unique_ids():
    themes = load_themes()

    assert len(themes) == 8
    assert all(len(theme["questions"]) == 7 for theme in themes)
    assert len({theme["id"] for theme in themes}) == 8
    assert {theme["category"] for theme in themes} <= {"travel", "work", "study", "exams", "daily_life"}


def test_the_epoch_is_a_monday():
    assert THEMES_EPOCH.weekday() == 0


def test_the_day_of_the_week_picks_the_question():
    first = load_themes()[0]

    assert theme_of_the_day(MONDAY)["question"] == first["questions"][0]
    assert theme_of_the_day(MONDAY + timedelta(days=6))["question"] == first["questions"][6]
    assert {theme_of_the_day(MONDAY + timedelta(days=d))["id"] for d in range(7)} == {first["id"]}


def test_the_theme_changes_on_monday():
    themes = load_themes()
    sunday, monday = MONDAY + timedelta(days=6), MONDAY + timedelta(days=7)

    assert theme_of_the_day(sunday)["id"] == themes[0]["id"]
    assert theme_of_the_day(monday)["id"] == themes[1]["id"]
    assert theme_of_the_day(monday)["question"] == themes[1]["questions"][0]


def test_the_themes_come_back_after_8_weeks_and_never_depend_on_chance():
    day = date(2026, 10, 14)

    assert theme_of_the_day(day) == theme_of_the_day(day + timedelta(weeks=8))
    assert theme_of_the_day(day) == theme_of_the_day(day)
    assert theme_of_the_day(day) != theme_of_the_day(day + timedelta(weeks=1))


def test_the_rotation_does_not_jump_at_new_year():
    # ISO week numbers go 52 -> 1 (or 53 -> 1): counting weeks from a fixed Monday keeps one step per week.
    last_monday_of_2026, first_monday_of_2027 = date(2026, 12, 28), date(2027, 1, 4)
    themes = [t["id"] for t in load_themes()]

    before = themes.index(theme_of_the_day(last_monday_of_2026)["id"])
    after = themes.index(theme_of_the_day(first_monday_of_2027)["id"])

    assert after == (before + 1) % len(themes)
