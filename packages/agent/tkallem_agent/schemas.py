"""Agent turn schema. Mirrors packages/contracts/agent_turn.schema.json."""
import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

Level = Literal["A2", "B1", "B2", "C1"]
ExplainLang = Literal["en", "fr"]
Status = Literal["green", "orange", "red"]
ErrorType = Literal["grammar", "vocabulary", "word_choice", "other"]
# Fine-grained category for the "Top mistakes" screen. Same list as packages/contracts (Correction.rule).
RULES = (
    "verb_tense", "subject_verb_agreement", "verb_pattern", "preposition", "article",
    "plural_uncountable", "word_order", "word_form", "other",
)
RuleType = Literal[
    "verb_tense", "subject_verb_agreement", "verb_pattern", "preposition", "article",
    "plural_uncountable", "word_order", "word_form", "other",
]


class Correction(BaseModel):
    model_config = ConfigDict(extra="forbid")

    original: str = Field(min_length=1)
    fixed: str = Field(min_length=1)
    type: ErrorType
    why: str = Field(min_length=1)  # in the session's explain_lang
    rule: RuleType | None = None  # optional: the model may leave it out, and an unknown value becomes None

    @model_validator(mode="after")
    def must_change_something(self):
        # Guardrail: a correction that changes nothing is refused.
        if self.original.strip().lower() == self.fixed.strip().lower():
            raise ValueError("correction does not change the text")
        return self


class AgentTurn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reply: str = Field(min_length=1)
    corrections: list[Correction] = Field(default_factory=list, max_length=3)
    sentence_status: Status
    goal_covered: str | None = None

    @model_validator(mode="after")
    def status_matches_corrections(self):
        # Spec: green = none; orange = 1-2 minor; red = 3+ (or meaning-changing error, set by the model).
        n = len(self.corrections)
        if n == 0 and self.sentence_status != "green":
            raise ValueError("no correction means green")
        if n > 0 and self.sentence_status == "green":
            raise ValueError("corrections present, status cannot be green")
        if n == 3 and self.sentence_status != "red":
            raise ValueError("3 corrections means red")
        return self


def _protected(text: str) -> set[str]:
    """Words a correction must never remove: numbers and capitalized words that are not at the sentence start."""
    words = re.findall(r"[A-Za-z0-9']+", text)
    return {w.lower() for i, w in enumerate(words) if w.isdigit() or (w[0].isupper() and i > 0 and w != "I")}


def _norm(text: str) -> str:
    return " ".join(re.sub(r"[.,!?;:]", " ", text.lower()).split())


def _only_study_number(original: str, fixed: str) -> bool:
    """"studies" is a correct noun ("it's not studies", "my studies"): turning it into "study" is noise. The other way
    ("my study" -> "my studies") stays allowed, it is often a real mistake."""
    a, b = _norm(original).split(), _norm(fixed).split()
    swap = {"studies": "study"}
    return len(a) == len(b) and a != b and all(x == y or swap.get(x) == y for x, y in zip(a, b))


_WORD = r"[A-Za-z0-9']+"


def _span(text: str, fragment: str) -> tuple[int, int] | None:
    """Where the fragment's words are in the text, ignoring case and the punctuation between words."""
    words = re.findall(_WORD, fragment)
    if not words:
        return None
    pattern = r"(?<![A-Za-z0-9'])" + r"[^A-Za-z0-9']+".join(map(re.escape, words)) + r"(?![A-Za-z0-9'])"
    m = re.search(pattern, text, re.I)
    return (m.start(), m.end()) if m else None


def _apply(text: str, c: dict) -> str | None:
    """The text with this correction applied, or None when its words are not there."""
    span = _span(text, c["original"])
    if span is None:
        return None
    fixed = c["fixed"].strip()
    if c["original"].strip()[-1:] in ".!?":  # the span stops at the last word: the sentence end stays in the text
        fixed = fixed.rstrip(".!?")
    return text[: span[0]] + fixed + text[span[1]:]


def _merge_overlaps(corrections: list[dict], text: str) -> list[dict]:
    """Corrections that share words become one, so the corrected sentence the student reads is right as a whole.
    "go to US for study" -> "go to the US to study" and "study my master" -> "study for my master's" give one fix of
    "go to US for study my master". When neither order applies both, the first alone is kept.
    Corrections come back in the order of the sentence."""
    placed, unplaced = [], []
    for c in corrections:
        span = _span(text, c["original"])
        (placed if span else unplaced).append((span, c))
    placed.sort(key=lambda item: item[0])
    out: list[tuple[tuple[int, int], dict]] = []
    for span, c in placed:
        if not out or span[0] >= out[-1][0][1]:
            out.append((span, c))
            continue
        (start, end), prev = out[-1]
        union = text[start:max(end, span[1])]
        fixed = None
        for first, second in ((prev, c), (c, prev)):  # "pay" -> "pays" first would hide "pay my studies": try both
            step = _apply(union, first)
            fixed = step and _apply(step, second)
            if fixed:
                break
        if not fixed or len(fixed.split()) > len(union.split()) + 3 or fixed.lower() == union.lower():
            continue
        merged = {**prev, "original": union, "fixed": fixed, "why": f"{prev['why'].strip()} {c['why'].strip()}"}
        out[-1] = ((start, max(end, span[1])), merged)
    return [c for _, c in out] + [c for _, c in unplaced]


def sanitize(raw: dict, goals: list[str] | None = None, student_text: str | None = None) -> dict:
    """Guardrails applied to raw model output before validation.

    Drops a correction when it: is malformed; changes nothing; quotes a fragment that is not in the student's text;
    removes a number or proper noun (meaning change, e.g. Germany -> USA); or rewrites far more words than it replaces.
    Merges corrections that touch the same words. Keeps at most 3, derives the status from the corrections so the
    model cannot contradict itself (a model-declared "red" is kept when corrections remain), and only accepts goal
    ids from the scenario.
    """
    out = dict(raw)
    kept = []
    for c in out.get("corrections") or []:
        if not isinstance(c, dict):
            c = c.model_dump() if isinstance(c, BaseModel) else {}
        if c.get("rule") not in RULES:
            c = {**c, "rule": None}  # an unknown rule must not cost the correction itself
        try:
            Correction.model_validate(c)  # malformed item (missing type, bad type...): dropped, the turn goes on
        except ValueError:
            continue
        original, fixed = str(c.get("original", "")).strip(), str(c.get("fixed", "")).strip()
        if not original or not fixed or original.lower() == fixed.lower():
            continue
        if student_text is not None and _norm(original) not in _norm(student_text):
            continue
        if _protected(original) - _protected(fixed):
            continue
        if len(fixed.split()) > len(original.split()) + 3:
            continue
        if _only_study_number(original, fixed):
            continue
        kept.append(c)
    if student_text is not None:
        kept = _merge_overlaps(kept, student_text)
    kept = kept[:3]
    out["corrections"] = kept
    if goals is not None and out.get("goal_covered") not in goals:
        out["goal_covered"] = None
    if not kept:
        out["sentence_status"] = "green"
    elif len(kept) == 3 or out.get("sentence_status") == "red":
        out["sentence_status"] = "red"
    else:
        out["sentence_status"] = "orange"
    return out
