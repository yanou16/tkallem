import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from tkallem_agent.graph import build_system_prompt
from tkallem_agent.schemas import AgentTurn, sanitize

C = {"original": "for study", "fixed": "to study", "type": "grammar", "why": "Le but : to + verbe."}


def test_valid_turn():
    t = AgentTurn(reply="Good.", corrections=[C], sentence_status="orange", goal_covered="purpose_of_trip")
    assert t.corrections[0].fixed == "to study"


def test_clean_sentence_is_green():
    AgentTurn(reply="Good.", corrections=[], sentence_status="green")
    with pytest.raises(ValidationError):
        AgentTurn(reply="Good.", corrections=[], sentence_status="orange")


def test_more_than_3_corrections_rejected():
    with pytest.raises(ValidationError):
        AgentTurn(reply="x", corrections=[C] * 4, sentence_status="red")


def test_noop_correction_rejected():
    with pytest.raises(ValidationError):
        AgentTurn(reply="x", corrections=[{**C, "fixed": "For study"}], sentence_status="orange")


def test_three_corrections_is_red():
    with pytest.raises(ValidationError):
        AgentTurn(reply="x", corrections=[C] * 3, sentence_status="orange")


def test_eval_set_integrity():
    rows = json.loads((Path(__file__).parents[1] / "evals/correction_set.json").read_text())
    assert len(rows) == 33
    assert len({r["id"] for r in rows}) == 33
    assert all(r["level"] in {"A2", "B1", "B2", "C1"} for r in rows)
    assert all(e["wrong"] != e["fixed"] for r in rows for e in r["errors"])


def test_system_prompt_contains_level_and_questions():
    from tkallem_agent.scenarios import load_scenario

    scenario = load_scenario("visa-us").model_dump()
    p = build_system_prompt("B1", scenario)
    assert "B1" in p and "What is the purpose of your trip?" in p and "max 12 words" in p


def test_sanitize_drops_noop_and_derives_status():
    from tkallem_agent.schemas import sanitize

    raw = {
        "reply": "ok",
        "corrections": [{**C, "original": "students", "fixed": "students"}],
        "sentence_status": "orange",
        "goal_covered": None,
    }
    out = AgentTurn.model_validate(sanitize(raw))
    assert out.corrections == [] and out.sentence_status == "green"


def test_sanitize_caps_at_three_and_marks_red():
    from tkallem_agent.schemas import sanitize

    raw = {"reply": "ok", "corrections": [C] * 5, "sentence_status": "orange", "goal_covered": None}
    out = AgentTurn.model_validate(sanitize(raw))
    assert len(out.corrections) == 3 and out.sentence_status == "red"


def test_sanitize_blocks_meaning_changes_and_rewrites():
    from tkallem_agent.schemas import sanitize

    base = {"reply": "ok", "sentence_status": "orange", "goal_covered": None}
    text = "I would like to study in Germany. I can pay my studies."
    cases = [
        {**C, "original": "in Germany", "fixed": "in the USA"},  # drops a proper noun
        {**C, "original": "in Mars", "fixed": "on Mars"},  # fragment not in the student's text
        {**C, "original": "pay my studies", "fixed": "pay for my studies with my savings and my family help"},  # rewrites
    ]
    for c in cases:
        assert sanitize({**base, "corrections": [c]}, None, text)["corrections"] == []
    ok = {**C, "original": "pay my studies", "fixed": "pay for my studies"}
    assert len(sanitize({**base, "corrections": [ok]}, None, text)["corrections"]) == 1


def test_rule_is_optional_and_kept_when_valid():
    from tkallem_agent.schemas import Correction, sanitize

    assert Correction(original="a", fixed="b", type="grammar", why="x").rule is None
    raw = {"reply": "ok", "corrections": [{**C, "rule": "verb_pattern"}], "sentence_status": "orange", "goal_covered": None}
    assert AgentTurn.model_validate(sanitize(raw)).corrections[0].rule == "verb_pattern"


def test_unknown_rule_becomes_none_without_losing_the_correction():
    from tkallem_agent.schemas import sanitize

    raw = {"reply": "ok", "corrections": [{**C, "rule": "tenses!!"}], "sentence_status": "orange", "goal_covered": None}
    turn = AgentTurn.model_validate(sanitize(raw))
    assert len(turn.corrections) == 1 and turn.corrections[0].rule is None


def _fix(original, fixed, why="x"):
    return {"original": original, "fixed": fixed, "type": "grammar", "why": why}


def test_overlapping_corrections_become_one_so_the_corrected_sentence_is_right():
    # Seen in production: the corrected sentence still said "to study my master", the second fix shown apart.
    text = "I go to US for study my master in computer science."
    raw = {"reply": "OK.", "sentence_status": "orange", "corrections": [
        _fix("go to US for study", "go to the US to study", "Article et but."),
        _fix("study my master", "study for my master's", "Study for + master's."),
    ]}
    out = sanitize(raw, None, text)
    assert len(out["corrections"]) == 1
    c = out["corrections"][0]
    assert c["original"] == "go to US for study my master"
    assert c["fixed"] == "go to the US to study for my master's"
    assert c["why"] == "Article et but. Study for + master's."
    assert out["sentence_status"] == "orange"
    AgentTurn.model_validate(out)


def test_separate_corrections_stay_apart_in_sentence_order():
    text = "Yesterday I go to the embassy and he have my papers."
    raw = {"reply": "OK.", "sentence_status": "orange", "corrections": [
        _fix("he have", "he has"), _fix("I go", "I went"),
    ]}
    out = sanitize(raw, None, text)
    assert [c["original"] for c in out["corrections"]] == ["I go", "he have"]


def test_overlap_that_cannot_be_combined_keeps_the_first():
    text = "I am agree with this plan."
    raw = {"reply": "OK.", "sentence_status": "orange", "corrections": [
        _fix("am agree", "agree"), _fix("I am agree", "I am in agreement"),
    ]}
    out = sanitize(raw, None, text)
    assert len(out["corrections"]) == 1


def test_sentence_end_is_not_doubled_when_merging():
    text = "My father pay my studies."
    raw = {"reply": "OK.", "sentence_status": "orange", "corrections": [
        _fix("My father pay", "My father pays"), _fix("pay my studies.", "pay for my studies."),
    ]}
    c = sanitize(raw, None, text)["corrections"][0]
    assert c["original"] == "My father pay my studies"
    assert c["fixed"] == "My father pays for my studies"


# ---------- improvement 4: praise and priority ----------

from tkallem_agent.schemas import praise_problem  # noqa: E402

ANSWER = "Yesterday I go to the embassy for my visa interview in Algiers, I wait 2 hours."


@pytest.mark.parametrize("praise", [
    "Nice detail about Algiers.",
    "You gave the place: 'the embassy'.",
    "Clear details about your visa interview.",
    "Good detail: 'I wait 2 hours'.",
])
def test_true_and_specific_praise_is_kept(praise):
    assert praise_problem(praise, ANSWER) is None


@pytest.mark.parametrize("praise, why", [
    ("Good job!", "generic"),
    ("Great answer, keep going.", "generic"),
    ("Good use of the past, but check 'go'.", "not only positive"),
    ("You should add more details.", "not only positive"),
    ("You quoted 'my passport' well.", "did not say"),
    ("You named Paris clearly.", "not in the answer"),
    ("Good detail: you waited 3 hours.", "not in the answer"),  # 3, not 2
    ("You explained very clearly and calmly all the details of your visa interview in Algiers today.", "more than 12"),
])
def test_generic_invented_or_mixed_praise_is_refused(praise, why):
    problem = praise_problem(praise, ANSWER)
    assert problem and why in problem


def test_sanitize_keeps_a_good_praise_and_drops_a_bad_one():
    base = {"reply": "OK.", "sentence_status": "orange", "corrections": [C]}
    text = "I go to the US for study."
    assert sanitize({**base, "praise": "Clear goal: you go to the US."}, None, text)["praise"] == "Clear goal: you go to the US."
    assert sanitize({**base, "praise": "Good job!"}, None, text)["praise"] is None
    assert sanitize({**base, "praise": 42}, None, text)["praise"] is None
    assert sanitize(base, None, text)["praise"] is None


def test_priority_follows_the_kept_corrections():
    text = "Yesterday I go to the embassy and he have my papers."
    go = {"original": "I go", "fixed": "I went", "type": "grammar", "why": "x"}
    have = {"original": "he have", "fixed": "he has", "type": "grammar", "why": "x"}
    invented = {"original": "my passport", "fixed": "the passport", "type": "grammar", "why": "x"}  # not in the text
    base = {"reply": "OK.", "sentence_status": "orange"}
    assert sanitize({**base, "corrections": [go, have], "priority_index": 1}, None, text)["priority_index"] == 1
    out = sanitize({**base, "corrections": [invented, go, have], "priority_index": 2}, None, text)
    assert [c["original"] for c in out["corrections"]] == ["I go", "he have"] and out["priority_index"] == 1
    assert sanitize({**base, "corrections": [invented, go], "priority_index": 0}, None, text)["priority_index"] == 0
    assert sanitize({**base, "corrections": [go], "priority_index": 7}, None, text)["priority_index"] == 0
    AgentTurn.model_validate(out)


def test_priority_must_point_at_a_correction():
    with pytest.raises(ValidationError):
        AgentTurn(reply="Good.", corrections=[C], sentence_status="orange", priority_index=1)
    AgentTurn(reply="Good.", corrections=[], sentence_status="green", priority_index=0)


def test_praise_quotes_with_an_ellipsis_and_names_in_quotes():
    assert praise_problem("Good parallel: 'my father is... and my mother too.'", "My father is a teacher and my mother too.") is None
    assert praise_problem("You included a clear detail: 'from Turkey'.", "He have a scholarship from Turkey.") is None


def test_a_praise_never_quotes_the_mistake():
    base = {"reply": "OK.", "sentence_status": "orange", "corrections": [C]}  # C fixes "for study"
    assert sanitize({**base, "praise": "You included a clear purpose: 'for study'."}, None, "I go to the US for study.")["praise"] is None
    assert sanitize({**base, "praise": "Clear goal: 'I go to the US'."}, None, "I go to the US for study.")["praise"] == "Clear goal: 'I go to the US'."


def test_priority_follows_a_merged_correction():
    # The model's priority (index 1, "study my master") is merged into the first fix: the merged one is the priority.
    text = "I go to US for study my master in computer science and he have a car."
    raw = {"reply": "OK.", "sentence_status": "orange", "priority_index": 1, "corrections": [
        _fix("go to US for study", "go to the US to study"), _fix("study my master", "study for my master's"),
        _fix("he have", "he has")]}
    out = sanitize(raw, None, text)
    assert [c["original"] for c in out["corrections"]] == ["go to US for study my master", "he have"]
    assert out["priority_index"] == 0
    raw["priority_index"] = 2
    assert sanitize(raw, None, text)["priority_index"] == 1
