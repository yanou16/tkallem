import pytest

from tkallem_agent.repeat import corrected_sentence, match_repeat, normalize


def fix(original, fixed):
    return {"original": original, "fixed": fixed, "type": "grammar", "why": "x"}


VISA = "I go to US for study."
VISA_FIXES = [fix("go to US for study", "go to the US to study")]
EMBASSY = "Yesterday I go to the embassy and I am agree with the officer."
EMBASSY_FIXES = [fix("I go", "I went"), fix("am agree", "agree")]


def test_corrected_sentence_applies_every_fix():
    assert corrected_sentence(VISA, VISA_FIXES) == "I go to the US to study."
    assert corrected_sentence(EMBASSY, EMBASSY_FIXES) == "Yesterday I went to the embassy and I agree with the officer."
    assert corrected_sentence("I have 22 years old.", [fix("I have 22 years old.", "I am 22 years old.")]) == "I am 22 years old."


def test_exact_repetition_is_nailed():
    r = match_repeat(VISA, VISA_FIXES, "I go to the US to study.")
    assert r.nailed and r.similarity == 1.0 and r.missing == []


@pytest.mark.parametrize("heard", ["i go to the u.s. to study", "Um, I go to the US to, uh, study."])
def test_case_punctuation_and_filler_words_do_not_matter(heard):
    assert match_repeat(VISA, VISA_FIXES, heard).nailed


def test_the_corrected_phrase_must_be_heard_as_corrected():
    r = match_repeat(VISA, VISA_FIXES, "I go to the United States to study.")
    assert not r.nailed and r.missing == ["go to the US to study"]


def test_contraction_variants_count_as_the_same_words():
    text, fixes = "I not like it.", [fix("I not like", "I don't like")]
    assert match_repeat(text, fixes, "I do not like it.").nailed
    assert match_repeat(text, fixes, "I don't like it").nailed
    text, fixes = "I am agree.", [fix("I am agree", "I agree")]
    assert match_repeat("I can't come and " + text, fixes, "I cannot come and I agree.").nailed


def test_a_missing_corrected_word_is_not_nailed_and_is_named():
    r = match_repeat(EMBASSY, EMBASSY_FIXES, "Yesterday I go to the embassy and I agree with the officer.")
    assert not r.nailed and r.missing == ["I went"]


def test_saying_the_mistake_again_is_not_nailed_even_when_very_similar():
    r = match_repeat(EMBASSY, EMBASSY_FIXES, "Yesterday I went to the embassy and I am agree with the officer.")
    assert r.similarity > 0.85
    assert not r.nailed and r.missing == ["agree"]


def test_far_from_the_sentence_is_not_nailed():
    r = match_repeat(EMBASSY, EMBASSY_FIXES, "I went. I agree.")
    assert r.missing == [] and r.similarity < 0.85 and not r.nailed


def test_numbers_said_as_words_or_digits():
    text, fixes = "I have 22 years old.", [fix("I have 22 years old", "I am 22 years old")]
    assert match_repeat(text, fixes, "I am 22 years old").nailed
    assert match_repeat("I stay two weeks there.", [fix("I stay", "I will stay")], "I will stay 2 weeks there.").nailed


def test_empty_or_silent_repetition():
    r = match_repeat(VISA, VISA_FIXES, "")
    assert not r.nailed and r.similarity == 0.0


def test_normalize():
    assert normalize("Um, I'm sure it's the U.S.!") == ["i", "am", "sure", "it", "is", "the", "us"]
    assert normalize("They won't, we'll see; my master's") == ["they", "will", "not", "we", "will", "see", "my", "master's"]
