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


def sanitize(raw: dict, goals: list[str] | None = None, student_text: str | None = None) -> dict:
    """Guardrails applied to raw model output before validation.

    Drops a correction when it: is malformed; changes nothing; quotes a fragment that is not in the student's text;
    removes a number or proper noun (meaning change, e.g. Germany -> USA); or rewrites far more words than it replaces.
    Keeps at most 3, derives the status from the corrections so the model cannot contradict itself
    (a model-declared "red" is kept when corrections remain), and only accepts goal ids from the scenario.
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
        kept.append(c)
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
