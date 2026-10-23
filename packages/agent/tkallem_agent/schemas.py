"""Agent turn schema. Mirrors packages/contracts/agent_turn.schema.json."""
import re
from difflib import SequenceMatcher
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
    # "Reassure before correcting" (docs/JURY_BRIEF.md, improvement 4): one short true positive about the answer, checked
    # by code (praise_problem), and the correction to show first; the others are folded in the app.
    praise: str | None = None
    priority_index: int = Field(0, ge=0)

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
        if self.priority_index >= max(n, 1):
            raise ValueError("priority_index must point at a correction")
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


def _combine_independent_edits(text: str, first: dict, second: dict) -> str | None:
    """Combine changes against shared context, refusing conflicting edits rather than guessing."""
    edits: list[tuple[int, int, str]] = []
    for correction in (first, second):
        result = _apply(text, correction)
        if result is None:
            return None
        for tag, start, end, new_start, new_end in SequenceMatcher(None, text, result, autojunk=False).get_opcodes():
            if tag == "equal":
                continue
            edit = (start, end, result[new_start:new_end])
            if edit in edits:
                continue
            for old_start, old_end, _ in edits:
                if (start == end and old_start <= start <= old_end
                        or old_start == old_end and start <= old_start <= end
                        or max(start, old_start) < min(end, old_end)):
                    return None
            edits.append(edit)
    result = text
    for start, end, replacement in sorted(edits, reverse=True):
        result = result[:start] + replacement + result[end:]
    return result


def _merge_overlaps(items: list[tuple[frozenset[int], dict]], text: str) -> list[tuple[frozenset[int], dict]]:
    """Corrections that share words become one, so the corrected sentence the student reads is right as a whole.
    "go to US for study" -> "go to the US to study" and "study my master" -> "study for my master's" give one fix of
    "go to US for study my master". Independent edits to shared context are combined; conflicting edits keep the first.
    Each item carries the model's positions it comes from (a merged one has both), so priority_index can follow it.
    Corrections come back in the order of the sentence."""
    placed, unplaced = [], []
    for tags, c in items:
        span = _span(text, c["original"])
        (placed if span else unplaced).append((span, tags, c))
    placed.sort(key=lambda item: item[0])
    out: list[tuple[tuple[int, int], frozenset[int], dict]] = []
    for span, tags, c in placed:
        if not out or span[0] >= out[-1][0][1]:
            out.append((span, tags, c))
            continue
        (start, end), prev_tags, prev = out[-1]
        union = text[start:max(end, span[1])]
        fixed = None
        for first, second in ((prev, c), (c, prev)):  # "pay" -> "pays" first would hide "pay my studies": try both
            step = _apply(union, first)
            fixed = step and _apply(step, second)
            if fixed:
                break
        if not fixed:
            fixed = _combine_independent_edits(union, prev, c)
        if not fixed or len(fixed.split()) > len(union.split()) + 3 or fixed.lower() == union.lower():
            continue
        merged = {**prev, "original": union, "fixed": fixed, "why": f"{prev['why'].strip()} {c['why'].strip()}"}
        out[-1] = ((start, max(end, span[1])), prev_tags | tags, merged)
    return [(tags, c) for _, tags, c in out] + [(tags, c) for _, tags, c in unplaced]


PRAISE_MAX_WORDS = 12
# Words a praise uses about anything: they do not show it is about THIS answer.
_PRAISE_WORDS = frozenset("""
good great nice well very really clear clearly answer answers sentence sentences idea ideas your with this that these
use used using word words english speak spoke said told explain explained explaining detail details specific strong
solid natural naturally correct correctly perfect excellent fluent confident confidently structure grammar vocabulary
tense past present future simple polite politely direct directly short full complete good-job job done keep point
reason reasons answered give gave giving well-done mention mentioned""".split())
_NOT_ONLY_POSITIVE = re.compile(r"\b(but|however|although|though|instead|should|next time|try|mistake|mistakes|error|errors|wrong)\b", re.I)
_QUOTED = re.compile(r"[\"“‘']([^\"”’']{2,})[\"”’']")


def _same_root(a: str, b: str) -> bool:
    """study / studies / studying: same word for a praise anchor."""
    if a == b:
        return True
    n = 0
    for x, y in zip(a, b):
        if x != y:
            break
        n += 1
    return n >= 4 and n >= min(len(a), len(b)) - 1


def _names(text: str) -> set[str]:
    """_protected() for a praise: quotes around a word ('from Turkey') do not hide the name."""
    return {w.strip("'").lower() for w in _protected(text.replace("‘", "'").replace("’", "'"))} - {""}


def praise_quotes(praise: str) -> list[str]:
    return [q for q in _QUOTED.findall(praise) if q.strip()]


def praise_problem(praise: str, student_text: str) -> str | None:
    """Why this praise is refused, or None. A praise must be short, only positive, and about something the learner
    actually said: a quoted fragment of their answer, or one of its words. Generic praise ("Good job!") is refused."""
    words = praise.split()
    if not words:
        return "empty"
    if len(words) > PRAISE_MAX_WORDS:
        return f"more than {PRAISE_MAX_WORDS} words"
    if _NOT_ONLY_POSITIVE.search(praise):
        return "not only positive"
    said = _norm(student_text)
    quoted = praise_quotes(praise)
    if any(_norm(part) not in said for q in quoted for part in re.split(r"\.\.\.|…", q) if part.strip()):
        return "quotes words the learner did not say"
    if _names(praise) - _names(student_text) - set(said.split()):
        return "names something that is not in the answer"
    if re.search(r"\d", praise) and not set(re.findall(r"\d+", praise)) <= set(re.findall(r"\d+", student_text)):
        return "a number that is not in the answer"
    content = [w for w in _norm(praise).split() if len(w) > 3 and w not in _PRAISE_WORDS]
    answer_words = [w for w in said.split() if len(w) > 2]
    shared_names = _names(praise) & _names(student_text)  # "the US", "Algiers", "2 hours"
    if not quoted and not shared_names and not any(_same_root(w, a) for w in content for a in answer_words):
        return "generic: about nothing the learner said"
    return None


def sanitize(raw: dict, goals: list[str] | None = None, student_text: str | None = None) -> dict:
    """Guardrails applied to raw model output before validation.

    Drops a correction when it: is malformed; changes nothing; quotes a fragment that is not in the student's text;
    removes a number or proper noun (meaning change, e.g. Germany -> USA); or rewrites far more words than it replaces.
    Merges corrections that touch the same words. Keeps at most 3, derives the status from the corrections so the
    model cannot contradict itself (a model-declared "red" is kept when corrections remain), and only accepts goal
    ids from the scenario. Keeps the praise only when praise_problem() finds nothing, and follows priority_index to
    the kept corrections, merged ones included (the first one when it points at a dropped or unknown correction).
    """
    out = dict(raw)
    kept = []
    positions = []  # index of each kept correction in the model's list, to follow its priority_index
    for i, c in enumerate(out.get("corrections") or []):
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
        positions.append(i)
    tagged = [(frozenset({p}), c) for p, c in zip(positions, kept)]
    if student_text is not None:
        tagged = _merge_overlaps(tagged, student_text)
    tagged = tagged[:3]
    kept = [c for _, c in tagged]
    out["corrections"] = kept
    wanted = raw.get("priority_index")
    out["priority_index"] = next((j for j, (tags, _) in enumerate(tagged) if wanted in tags), 0) if isinstance(wanted, int) else 0
    praise = raw.get("praise")
    praise = " ".join(praise.split()) if isinstance(praise, str) else ""
    # A praise that quotes the wrong words ("Clear purpose: 'for study'") would praise the mistake itself.
    wrong = [_norm(str(c.get("original", ""))) for c in kept]
    praises_a_mistake = any(_norm(q) in w or w in _norm(q) for q in praise_quotes(praise) for w in wrong if w and _norm(q))
    ok = praise and student_text is not None and not praises_a_mistake and praise_problem(praise, student_text) is None
    out["praise"] = praise if ok else None
    if goals is not None and out.get("goal_covered") not in goals:
        out["goal_covered"] = None
    if not kept:
        out["sentence_status"] = "green"
    elif len(kept) == 3 or out.get("sentence_status") == "red":
        out["sentence_status"] = "red"
    else:
        out["sentence_status"] = "orange"
    return out
