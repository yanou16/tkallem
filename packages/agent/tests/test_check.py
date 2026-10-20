import pytest
from langchain_core.messages import HumanMessage, SystemMessage

from tkallem_agent.check import check_text
from tkallem_agent.graph import learner_text
from tkallem_agent.schemas import Correction
from tkallem_agent.session import AgentError
from tkallem_agent.testing import FakeChat

TEXT = "Yesterday I go to the university for study."
FIX = {"original": "for study", "fixed": "to study", "type": "grammar", "why": "Le but : to + verbe.", "rule": "verb_pattern"}
TENSE = {"original": "I go", "fixed": "I went", "type": "grammar", "why": "Passé : went.", "rule": "verb_tense"}


def test_returns_the_corrections_with_their_rule():
    corrections = check_text(TEXT, "B1", llm=FakeChat(found=[{"input_issue": None, "corrections": [FIX]}]))

    assert corrections == [Correction(**FIX)]
    assert corrections[0].rule == "verb_pattern"


def test_a_clean_text_has_no_correction():
    assert check_text("I went to the university to study.", "B1", llm=FakeChat(found=[{"input_issue": None, "corrections": []}])) == []


def test_the_same_guardrails_as_a_coach_turn():
    found = [
        FIX,
        {**TENSE, "rule": "tense"},  # unknown rule: kept, rule becomes None
        {"original": "blue sky", "fixed": "blue skies", "type": "grammar", "why": "x"},  # not in the text: dropped
        {"original": "university", "fixed": "university", "type": "vocabulary", "why": "x"},  # changes nothing: dropped
    ]

    corrections = check_text(TEXT, "B1", llm=FakeChat(found=[{"input_issue": None, "corrections": found}]))

    # in the order of the sentence, as sanitize returns them
    assert [(c.original, c.rule) for c in corrections] == [("I go", None), ("for study", "verb_pattern")]


def test_at_most_three_corrections():
    text = "Yesterday I go to the university for study and I buy a books in the shop."
    found = [
        FIX,
        TENSE,
        {"original": "I buy", "fixed": "I bought", "type": "grammar", "why": "Passé.", "rule": "verb_tense"},
        {"original": "a books", "fixed": "a book", "type": "grammar", "why": "Singulier.", "rule": "article"},
    ]

    assert len(check_text(text, "B1", llm=FakeChat(found=[{"input_issue": None, "corrections": found}]))) == 3


def test_it_is_the_corrector_prompt_and_the_text_is_framed_as_data():
    llm = FakeChat(found=[{"input_issue": None, "corrections": []}])

    check_text("  Yesterday   I go to the university.  ", "B2", "en", llm=llm)

    [messages] = llm.seen["Found"]
    system, human = messages
    assert isinstance(system, SystemMessage) and "B2" in system.content and "SIMPLE English" in system.content
    assert isinstance(human, HumanMessage)
    assert human.content == learner_text("Yesterday I go to the university.")  # spaces cleaned like an answer


def test_explanations_in_french_by_default():
    llm = FakeChat(found=[{"input_issue": None, "corrections": []}])

    check_text(TEXT, "A2", llm=llm)

    assert "in French" in llm.seen["Found"][0][0].content


def test_no_coach_and_no_scenario_only_the_corrector():
    llm = FakeChat(found=[{"input_issue": None, "corrections": [FIX]}])

    check_text(TEXT, "B1", llm=llm)

    assert dict(llm.calls) == {"Found": 1}


@pytest.mark.parametrize(
    "text, level, explain_lang",
    [("", "B1", "fr"), ("   ", "B1", "fr"), ("x" * 1001, "B1", "fr"), (TEXT, "Z9", "fr"), (TEXT, "B1", "de")],
    ids=["empty", "spaces", "too_long", "unknown_level", "unknown_language"],
)
def test_invalid_input_is_refused_without_calling_the_model(text, level, explain_lang):
    llm = FakeChat(found=[{"input_issue": None, "corrections": []}])

    with pytest.raises(ValueError):
        check_text(text, level, explain_lang, llm=llm, max_text_chars=1000)
    assert sum(llm.calls.values()) == 0


def test_a_provider_error_is_retried_once_with_a_compact_request():
    llm = FakeChat(found=[RuntimeError("provider hiccup"), {"input_issue": None, "corrections": [FIX]}])

    corrections = check_text(TEXT, "B1", llm=llm)

    assert [c.fixed for c in corrections] == ["to study"]
    assert llm.calls["Found"] == 2
    assert "compact JSON" in llm.seen["Found"][1][-1].content


def test_two_errors_are_an_agent_error():
    llm = FakeChat(found=[RuntimeError("down"), RuntimeError("still down")])

    with pytest.raises(AgentError, match="corrector failed"):
        check_text(TEXT, "B1", llm=llm)


def test_a_missing_llm_key_is_an_agent_error(monkeypatch):
    from tkallem_agent import llm as llm_module

    monkeypatch.setenv("LLM_PROVIDER", "openrouter")
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    monkeypatch.setattr(llm_module, "_load_dotenv_once", lambda: None)  # no .env in this test
    llm_module.default_llm.cache_clear()

    with pytest.raises(AgentError, match="not configured"):
        check_text(TEXT, "B1")  # llm=None: built from the environment, like the API does


@pytest.mark.parametrize("text, issue", [("ich bin", "non_english"), ("hallon", "unclear")])
def test_non_english_or_unclear_drafts_are_not_marked_correct(text, issue):
    llm = FakeChat(found=[{"input_issue": issue, "corrections": []}])
    with pytest.raises(ValueError, match="Write a clear message in English"):
        check_text(text, "B1", llm=llm)


@pytest.mark.parametrize("raw", [None, {}, {"corrections": []}, {"input_issue": None, "corrections": None}])
def test_invalid_output_retries_instead_of_marking_the_draft_correct(raw):
    llm = FakeChat(found=[raw, {"input_issue": None, "corrections": [FIX]}])
    assert check_text(TEXT, "B1", llm=llm)[0].fixed == "to study"
    assert llm.calls["Found"] == 2


def test_repeated_invalid_output_is_unavailable_not_correct():
    with pytest.raises(AgentError):
        check_text(TEXT, "B1", llm=FakeChat(found=[None, None]))


@pytest.mark.parametrize("text", ["Hello", "My day was very good", "I had a very good day"])
def test_correct_short_and_adjective_drafts_stay_unchanged(text):
    assert check_text(text, "B1", llm=FakeChat(found=[{"input_issue": None, "corrections": []}])) == []


@pytest.mark.parametrize("text, original, fixed, rule, explanation", [
    ("I goed", "goed", "went", "verb_tense", "Le passé de go est irrégulier : went."),
    ("I had a very well day", "a very well day", "a very good day", "word_form",
     "Good est un adjectif qui décrit day. Well est normalement un adverbe."),
])
def test_english_errors_keep_the_correction_and_explanation(text, original, fixed, rule, explanation):
    proposed = {"original": original, "fixed": fixed, "type": "grammar", "why": explanation, "rule": rule}
    result = check_text(text, "B1", llm=FakeChat(found=[{"input_issue": None, "corrections": [proposed]}]))
    assert result == [Correction(**proposed)]
