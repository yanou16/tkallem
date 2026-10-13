import pytest

from tkallem_agent import CoachSession
from tkallem_agent.graph import INTERVIEW_RULES, build_system_prompt
from tkallem_agent.scenarios import load_scenario
from tkallem_agent.testing import FakeChat

FOUND = {"corrections": [{"original": "for study", "fixed": "to study", "type": "grammar", "why": "Le but : to + verbe."}],
         "praise": "Clear goal: you go to the US."}
REPLY = {"reaction": "I see.", "goal_covered": "purpose_of_trip"}


def test_practice_is_the_default_and_the_coach_is_encouraging():
    s = CoachSession("visa-us", "B1")
    assert s.feedback_mode == "practice"
    assert "REAL INTERVIEW MODE" not in build_system_prompt("B1", load_scenario("visa-us").model_dump())


def test_the_interview_prompt_makes_the_coach_neutral_for_guided_and_free_scenarios():
    for sid in ("visa-us", "free-talk"):
        prompt = build_system_prompt("B1", load_scenario(sid).model_dump(), interview=True)
        assert prompt.endswith(INTERVIEW_RULES) and "do NOT encourage, praise" in prompt


def test_the_mode_reaches_the_coach_call_and_survives_a_reload():
    llm = FakeChat(found=[FOUND], replies=[REPLY])
    s = CoachSession("visa-us", "B1", llm=llm, feedback_mode="interview")
    s.turn("I go to the US for study.")
    system = llm.seen["Reply"][0][0].content
    assert "REAL INTERVIEW MODE" in system
    again = CoachSession.from_state(s.to_state(), llm=llm)
    assert again.feedback_mode == "interview"


def test_the_corrections_are_still_computed_in_an_interview():
    llm = FakeChat(found=[FOUND], replies=[REPLY])
    turn = CoachSession("visa-us", "B1", llm=llm, feedback_mode="interview").turn("I go to the US for study.")
    assert [c.fixed for c in turn.corrections] == ["to study"] and turn.praise == "Clear goal: you go to the US."


def test_a_session_saved_before_the_modes_is_a_practice_session():
    state = CoachSession("visa-us", "B1").to_state()
    del state["feedback_mode"]
    assert CoachSession.from_state(state).feedback_mode == "practice"


def test_unknown_mode_is_refused():
    with pytest.raises(ValueError):
        CoachSession("visa-us", "B1", feedback_mode="exam")


@pytest.mark.parametrize("reaction", ["Good reason!", "Great, you want to study.", "Well done.", "That is an excellent plan."])
def test_praise_in_an_interview_is_replaced_by_a_neutral_acknowledgement(reaction):
    llm = FakeChat(found=[{"corrections": []}], replies=[{"reaction": reaction, "goal_covered": "purpose_of_trip"}])
    turn = CoachSession("visa-us", "B1", llm=llm, feedback_mode="interview").turn("I go to the US to study.")
    assert turn.reply.startswith("Thank you.")


def test_the_same_reaction_is_kept_in_practice_and_neutral_ones_are_kept_in_an_interview():
    llm = FakeChat(found=[{"corrections": []}] * 2, replies=[{"reaction": "Good reason!", "goal_covered": "purpose_of_trip"},
                                                              {"reaction": "I see.", "goal_covered": "purpose_of_trip"}])
    assert CoachSession("visa-us", "B1", llm=llm).turn("I go to the US to study.").reply.startswith("Good reason!")
    assert CoachSession("visa-us", "B1", llm=llm, feedback_mode="interview").turn("I go to the US to study.").reply.startswith("I see.")
