"""The interview verdict is computed by code from the report's traffic lights (app/verdict.py)."""
from app.verdict import MIN_ANSWERS, interview_verdict

GREEN = {"mistakes_per_100": 2.0, "words_per_answer": 18.0, "hesitations_per_min": 1.0}


def test_all_green_is_ready_and_the_reasons_are_the_first_two_strengths():
    v = interview_verdict(GREEN, 5)
    assert v["status"] == "ready"
    assert [r["metric"] for r in v["reasons"]] == ["mistakes_per_100", "words_per_answer"]
    assert {r["level"] for r in v["reasons"]} == {"green"}


def test_one_orange_is_almost_and_the_orange_metric_comes_first():
    v = interview_verdict({**GREEN, "words_per_answer": 9.0}, 4)
    assert v["status"] == "almost"
    assert v["reasons"][0] == {"metric": "words_per_answer", "level": "orange", "value": 9.0}


def test_one_red_is_not_yet_even_when_the_others_are_green():
    v = interview_verdict({**GREEN, "hesitations_per_min": 7.5}, 4)
    assert v["status"] == "not_yet"
    assert v["reasons"][0]["metric"] == "hesitations_per_min" and v["reasons"][0]["level"] == "red"


def test_the_two_weakest_are_given_red_before_orange_before_green():
    v = interview_verdict({"mistakes_per_100": 9.0, "words_per_answer": 9.0, "hesitations_per_min": 1.0}, 4)
    assert [(r["metric"], r["level"]) for r in v["reasons"]] == [("mistakes_per_100", "red"), ("words_per_answer", "orange")]


def test_a_typed_session_is_judged_without_hesitations():
    v = interview_verdict({"mistakes_per_100": 2.0, "words_per_answer": 18.0, "hesitations_per_min": None}, 3)
    assert v["status"] == "ready" and len(v["reasons"]) == 2


def test_the_thresholds_are_the_report_ones():
    # 4 and 8 mistakes per 100 words are the green and red limits of the report: the verdict must agree with the pill.
    assert interview_verdict({**GREEN, "mistakes_per_100": 3.9}, 4)["status"] == "ready"
    assert interview_verdict({**GREEN, "mistakes_per_100": 4.0}, 4)["status"] == "almost"
    assert interview_verdict({**GREEN, "mistakes_per_100": 8.1}, 4)["status"] == "not_yet"


def test_too_few_answers_or_nothing_said_gives_no_verdict():
    assert interview_verdict(GREEN, MIN_ANSWERS - 1) is None
    assert interview_verdict({**GREEN, "mistakes_per_100": None}, 5) is None


def test_the_same_practice_is_judged_at_the_level_of_the_student():
    typed = {"mistakes_per_100": 5.0, "words_per_answer": 10.0, "hesitations_per_min": None}
    by_level = {lvl: interview_verdict(typed, 4, lvl)["status"] for lvl in ("A2", "B1", "B2", "C1")}
    assert by_level == {"A2": "ready", "B1": "almost", "B2": "almost", "C1": "not_yet"}


def test_the_verdict_says_the_level_it_was_judged_at():
    assert interview_verdict(GREEN, 4, "A2")["level"] == "A2"
    assert interview_verdict(GREEN, 4)["level"] == "B1"  # no level given: B1, as the report


def test_an_unknown_or_missing_level_is_judged_as_b1():
    typed = {"mistakes_per_100": 5.0, "words_per_answer": 10.0, "hesitations_per_min": None}
    assert interview_verdict(typed, 4, "Z9") == interview_verdict(typed, 4, "B1")
    assert interview_verdict(typed, 4, None)["level"] == "B1"


def test_the_reasons_follow_the_level_too():
    v = interview_verdict({"mistakes_per_100": 7.0, "words_per_answer": 18.0, "hesitations_per_min": 1.0}, 4, "A2")
    assert [(r["metric"], r["level"]) for r in v["reasons"]] == [("mistakes_per_100", "orange"), ("words_per_answer", "green")]
    v = interview_verdict({"mistakes_per_100": 7.0, "words_per_answer": 18.0, "hesitations_per_min": 1.0}, 4, "B2")
    assert (v["status"], v["reasons"][0]["level"]) == ("not_yet", "red")
