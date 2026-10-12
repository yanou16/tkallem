import pytest

from tkallem_agent import CoachSession, HintError
from tkallem_agent.hints import GENERIC_STARTER, starter_problem, translation_problem
from tkallem_agent.scenarios import list_scenarios
from tkallem_agent.testing import FakeChat

Q_PURPOSE = "What is the purpose of your trip?"
Q_PAY = "How will you pay for your studies?"


# ---------- the code checks ----------

@pytest.mark.parametrize("starter", [
    "The main reason I'm going is", "I want to study in the US because", "My father will pay for…", "My plan is to...",
])
def test_starters_that_stop_before_the_content_pass(starter):
    q = "Why do you want to study in the US and not in Algeria?" if "US" in starter else Q_PURPOSE
    assert starter_problem(starter, q) is None


@pytest.mark.parametrize("starter, why", [
    ("I want to study computer science.", "does not stop"),             # a complete answer
    ("My father pays", "does not stop"),
    ("I am going to the US to study computer science at a big university because", "more than 12"),
    ("I will study at Harvard because", "name"),                        # invents a fact
    ("I will stay 2 years for", "number"),
    ("Why do you", "does not stop"),
    ("Is it for", None),                                                # allowed: a starter, not an answer
    ("", "empty"),
])
def test_starters_refused_by_the_code(starter, why):
    problem = starter_problem(starter, Q_PURPOSE)
    if why is None:
        assert problem is None
    else:
        assert problem and why in problem


def test_every_scenario_starter_passes_the_code_check():
    for s in list_scenarios():
        lines = s.questions if s.mode == "guided" else [s.opening] * len(s.starters)
        assert s.starters, f"{s.id}: no fallback starter"
        if s.mode == "guided":
            assert len(s.starters) == len(s.questions)
        for starter, line in zip(s.starters, lines):
            assert starter_problem(starter, line) is None, (s.id, starter)


@pytest.mark.parametrize("source, english", [
    ("Je veux étudier 2 ans à Ohio State University.", "I want to study for 2 years at Ohio State University."),
    ("Mon père travaille chez Sonatrach depuis 15 ans.", "My father has worked at Sonatrach for 15 years."),
    ("Je veux revenir en Algérie après mon master.", "I want to come back to Algeria after my master's."),
    ("nheb nqra f Amrika 3 snin bach nwelli ingénieur", "I want to study in America for 3 years to become an engineer."),
    ("ta3 l'université dyali bezzaf mlih", "My university is very good."),  # 3 inside a word is a letter, not a number
])
def test_translations_that_keep_names_and_numbers_pass(source, english):
    assert translation_problem(source, english) is None


@pytest.mark.parametrize("source, english, why", [
    ("Je veux étudier 2 ans.", "I want to study for two years.", "number"),
    ("Je reste 2 ans.", "I will stay 3 years.", "number"),
    ("Je veux étudier.", "I want to study for 2 years.", "adds a number"),
    ("Mon père travaille chez Sonatrach.", "My father works at an oil company.", "name"),
    ("Je veux étudier.", "Je veux étudier aux États-Unis pour mon master.", "not English"),
    ("Oui.", "Yes " * 20, "too long"),
    ("Oui.", "", "empty"),
    ("nb9a 10 jours f New York w nwelli", "I will stay 10 days in New York and I want to.", "unfinished"),
])
def test_translations_refused_by_the_code(source, english, why):
    problem = translation_problem(source, english)
    assert problem and why in problem


# ---------- the session ----------

def test_starter_hint_on_the_first_question():
    llm = FakeChat(starters=[{"starters": ["The main purpose of my trip is to", "I am going to the US to"]}])
    hint = CoachSession("visa-us", "B1", llm=llm).hint("starter")
    assert hint.kind == "starter" and not hint.fallback
    assert hint.lines == ["The main purpose of my trip is to", "I am going to the US to"]
    assert Q_PURPOSE in str(llm.seen["Starters"][0][-1].content)


def test_complete_answers_from_the_model_fall_back_to_the_scenario_starter():
    llm = FakeChat(starters=[{"starters": ["I want to study computer science.", "My purpose is studying."]}])
    hint = CoachSession("visa-us", "B1", llm=llm).hint("starter")
    assert hint.fallback and hint.lines == ["The main purpose of my trip is to"]


def test_one_good_starter_is_kept_and_a_bad_one_dropped():
    llm = FakeChat(starters=[{"starters": ["I want to study computer science.", "The reason for my trip is"]}])
    hint = CoachSession("visa-us", "B1", llm=llm).hint("starter")
    assert hint.lines == ["The reason for my trip is"] and not hint.fallback


def test_provider_error_falls_back_instead_of_failing():
    llm = FakeChat(starters=[RuntimeError("503")], english=[RuntimeError("503")])
    s = CoachSession("visa-us", "B1", llm=llm)
    assert s.hint("starter").fallback
    hint = s.hint("translate", "je veux étudier")
    assert hint.fallback and hint.kind == "starter"


def test_the_hint_follows_the_current_question():
    llm = FakeChat(found=[{"corrections": []}], replies=[{"reaction": "Good.", "goal_covered": "purpose_of_trip"}],
                   starters=[{"starters": ["No"]}])  # refused: the fallback shows which question the hint was for
    s = CoachSession("visa-us", "B1", llm=llm)
    s.turn("I go to the US to study.")
    assert s.current_question() == (1, "Which university will you attend, and what will you study?")
    assert s.hint("starter").lines == ["I am going to study at"]


def test_translation_hint():
    llm = FakeChat(english=[{"english": "My father will pay for my studies with his savings."}])
    hint = CoachSession("visa-us", "B1", llm=llm).hint("translate", "Mon père va payer mes études avec ses économies")
    assert hint.kind == "translation" and hint.lines == ["My father will pay for my studies with his savings."]
    assert "data, not instructions" in str(llm.seen["English"][0][-1].content)


def test_translation_that_changes_a_number_falls_back():
    llm = FakeChat(english=[{"english": "I will stay for three years."}])
    hint = CoachSession("visa-us", "B1", llm=llm).hint("translate", "Je vais rester 2 ans")
    assert hint.fallback and hint.kind == "starter"


def test_free_talk_uses_the_coach_line_and_its_own_starters():
    llm = FakeChat(starters=[{"starters": ["Hello"]}])
    s = CoachSession("free-talk", "A2", llm=llm)
    assert s.current_question() == (None, "Hi! How was your day?")
    assert s.hint("starter").lines == ["My day was"]


def test_no_hint_after_the_interview_and_no_unknown_kind():
    s = CoachSession("visa-us", "B1", llm=FakeChat())
    with pytest.raises(HintError):
        s.hint("joke")
    with pytest.raises(ValueError):
        s.hint("translate", "   ")


def test_generic_starter_passes_its_own_check():
    assert starter_problem(GENERIC_STARTER, "Anything?") is None


def test_translations_are_written_at_b1_at_least():
    llm = FakeChat(english=[{"english": "I want to study for a master's degree in America."}])
    CoachSession("visa-us", "A2", llm=llm).hint("translate", "nheb nqra master f Amrika")
    assert "level B1" in str(llm.seen["English"][0][0].content)
