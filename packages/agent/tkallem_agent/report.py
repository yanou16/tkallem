"""End-of-session report (F7). Numbers, colors and structure are computed by code; the LLM only writes the short note,
from structured facts, and the note is rejected if it contains a number that is not in the facts."""
import json
import re
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path

from langchain_core.language_models import BaseChatModel
from pydantic import BaseModel

from .schemas import Correction, ExplainLang, Level, Status

NOTE_PROMPT = (Path(__file__).parent.parent / "prompts" / "report_note.md").read_text()
FILLERS = re.compile(r"\b(?:u+h+|u+m+|e+r+m*|h+m+|euh+)\b", re.I)
LANG_NAME = {"en": "simple English", "fr": "French"}

# Thresholds from the spec (starting points, to be tuned after tests with real students).
# name: (green_if, red_if, higher_is_better)
THRESHOLDS = {
    "mistakes_per_100": (4, 8, False),
    "words_per_answer": (12, 6, True),
    "hesitations_per_min": (3, 6, False),
}


@dataclass
class TurnRecord:
    student_text: str
    corrections: list[Correction] = field(default_factory=list)
    status: Status = "green"


class Report(BaseModel):
    lines: list[dict]
    note: str
    metrics: dict[str, float | None]
    levels: dict[str, Status | None]  # proposed addition to the contract: traffic light per metric
    redo_index: int | None  # index in `lines` of the answer to redo (see redo_target), if any


def words(text: str) -> int:
    return len(re.findall(r"[A-Za-z0-9']+", text))


def level_of(name: str, value: float | None) -> Status | None:
    if value is None:
        return None
    green, red, higher_better = THRESHOLDS[name]
    if higher_better:
        return "green" if value > green else "red" if value < red else "orange"
    return "green" if value < green else "red" if value > red else "orange"


def compute_metrics(turns: list[TurnRecord], speaking_seconds: float | None = None) -> dict[str, float | None]:
    total_words = sum(words(t.student_text) for t in turns)
    n_mistakes = sum(len(t.corrections) for t in turns)
    fillers = sum(len(FILLERS.findall(t.student_text)) for t in turns)
    minutes = speaking_seconds / 60 if speaking_seconds else None
    return {
        "words": total_words,
        "mistakes_per_100": round(n_mistakes / total_words * 100, 1) if total_words else None,
        "words_per_answer": round(total_words / len(turns), 1) if turns else None,
        "hesitations_per_min": round(fillers / minutes, 1) if minutes else None,
        "speaking_seconds": speaking_seconds,
    }


def facts_for(turns: list[TurnRecord], metrics: dict, levels: dict, level: Level) -> dict:
    types = Counter(c.type for t in turns for c in t.corrections)
    statuses = Counter(t.status for t in turns)
    examples = [f"{c.original} -> {c.fixed}" for t in turns for c in t.corrections][:3]
    return {
        "level": level,
        "answers": len(turns),
        "clean_answers": statuses["green"],
        "answers_with_small_fixes": statuses["orange"],
        "answers_to_redo": statuses["red"],
        "mistakes_per_100_words": metrics["mistakes_per_100"],
        "mistakes_per_100_words_color": levels["mistakes_per_100"],
        "words_per_answer": metrics["words_per_answer"],
        "words_per_answer_color": levels["words_per_answer"],
        "most_frequent_mistake_types": [t for t, _ in types.most_common(2)],
        "example_corrections": examples,
    }


def numbers_in(text: str) -> set[str]:
    return set(re.findall(r"\d+(?:[.,]\d+)?", text.replace(",", ".")))


def fallback_note(facts: dict, lang: ExplainLang) -> str:
    n, clean, redo = facts["answers"], facts["clean_answers"], facts["answers_to_redo"]
    top = facts["most_frequent_mistake_types"]
    if lang == "fr":
        s = f"Tu as répondu {n} fois ; {clean} réponses étaient propres et {redo} sont à refaire."
        return s + (f" À travailler en priorité : {top[0]}." if top else " Continue comme ça.")
    s = f"You answered {n} times: {clean} answers were clean and {redo} need a redo."
    return s + (f" Work first on: {top[0]}." if top else " Keep going.")


def write_note(llm: BaseChatModel, facts: dict, level: Level, lang: ExplainLang, config: dict | None = None) -> str:
    allowed = numbers_in(json.dumps(facts))
    prompt = NOTE_PROMPT.format(level=level, lang_name=LANG_NAME[lang], facts=json.dumps(facts, ensure_ascii=False))
    try:
        note = str(llm.invoke(prompt, config=config).content).strip()
    except Exception:  # network or provider error: the report must still be shown
        return fallback_note(facts, lang)
    if not note or not numbers_in(note) <= allowed:  # invented number: reject the note
        return fallback_note(facts, lang)
    return note


def build_report(
    turns: list[TurnRecord],
    llm: BaseChatModel,
    level: Level,
    explain_lang: ExplainLang = "fr",
    speaking_seconds: float | None = None,
    coach_lines: list[str] | None = None,
    config: dict | None = None,
) -> Report:
    """`coach_lines`: coach messages in order (coach[i] precedes student turn i, an extra last one closes the
    transcript). `config`: LangChain run config (tracing)."""
    metrics = compute_metrics(turns, speaking_seconds)
    levels = {name: level_of(name, metrics[name]) for name in THRESHOLDS}
    lines: list[dict] = []
    student_line: list[int] = []
    for i, t in enumerate(turns):
        if coach_lines and i < len(coach_lines):
            lines.append({"role": "coach", "text": coach_lines[i], "status": None, "corrections": []})
        lines.append(
            {"role": "student", "text": t.student_text, "status": t.status, "corrections": [c.model_dump() for c in t.corrections]}
        )
        student_line.append(len(lines) - 1)
    if coach_lines and len(coach_lines) > len(turns):  # last coach line (closing or reaction) ends the transcript
        lines.append({"role": "coach", "text": coach_lines[len(turns)], "status": None, "corrections": []})
    facts = facts_for(turns, metrics, levels, level)
    note = write_note(llm, facts, level, explain_lang, config) if turns else ""
    return Report(lines=lines, note=note, metrics=metrics, levels=levels, redo_index=redo_target(turns, student_line))


def redo_target(turns: list[TurnRecord], student_line: list[int]) -> int | None:
    """Line to redo: the red answer, else the orange answer with the most corrections (first one on ties).
    None when every answer is clean."""
    rank = {"green": 0, "orange": 1, "red": 2}
    candidates = [(rank[t.status], len(t.corrections), -i) for i, t in enumerate(turns) if t.status != "green"]
    if not candidates:
        return None
    _, _, neg_i = max(candidates)
    return student_line[-neg_i]
