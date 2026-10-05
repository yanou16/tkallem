"""Write the human-review sheets the spec asks for (Markdown, in evals/review/, git-ignored). Needs LLM env vars.

  F5: the 30-sentence set with the corrections and explanations: tick each fix and explanation.
  F3: 20 coach replies (5 per level, A2 to C1): tick "stays at the level". Sentence length is pre-checked by code.

Usage: python evals/review_sheet.py [--lang fr|en]
"""
import argparse
import json
from datetime import date
from pathlib import Path

from tkallem_agent import CoachSession, tracing
from tkallem_agent.graph import build_graph, sentences
from tkallem_agent.report import words as word_count
from tkallem_agent.levels import MAX_WORDS
from tkallem_agent.llm import default_llm
from tkallem_agent.scenarios import load_scenario

ROOT = Path(__file__).parent
OUT = ROOT / "review"
CHAT = [
    "Today I wake up very late and I miss the bus.",
    "At work my manager is angry because I arrive late to the meeting.",
    "I think I will buy an alarm clock and go to sleep earlier.",
    "In the weekend I want to visit my family in Oran.",
    "My plan is to study in Germany next year.",
]


def corrections_sheet(lang: str) -> Path:
    graph = build_graph(default_llm())
    visa = load_scenario("visa-us").model_dump()
    rows = json.loads((ROOT / "correction_set.json").read_text())
    lines = [
        f"# F5 review: corrections and explanations ({lang}) - {date.today()}",
        "",
        "For each sentence tick: the fix is right, the explanation is right, no new mistake was introduced.",
        "",
        "| id | sentence | correction | explanation | fix OK | explanation OK | no new fault |",
        "|---|---|---|---|---|---|---|",
    ]
    for r in rows:
        out = graph.invoke({"level": r["level"], "scenario": visa, "student_text": r["sentence"], "history": [], "explain_lang": lang})
        turn = out.get("turn")
        fixes = "<br>".join(f"~~{c.original}~~ → **{c.fixed}**" for c in turn.corrections) if turn else "INVALID OUTPUT"
        whys = "<br>".join(c.why for c in turn.corrections) if turn else ""
        lines.append(f"| {r['id']} | {r['sentence']} | {fixes or '(none)'} | {whys} | ☐ | ☐ | ☐ |")
    path = OUT / f"f5_corrections_{lang}.md"
    path.write_text("\n".join(lines) + "\n")
    return path


def level_sheet() -> tuple[Path, int]:
    lines = [
        f"# F3 review: does the coach stay at the declared level? - {date.today()}",
        "",
        "Spec target: 0 reply above the declared level on 20 exchanges. 'longest' is the longest sentence in words (code check).",
        "",
        "| level | student | coach | longest / max | at the level |",
        "|---|---|---|---|---|",
    ]
    over = 0
    for level in MAX_WORDS:
        s = CoachSession("free-talk", level)
        for text in CHAT:
            turn = s.turn(text)
            longest = max((word_count(x) for x in sentences(turn.reply)), default=0)
            over += longest > MAX_WORDS[level]
            flag = "" if longest <= MAX_WORDS[level] else " ⚠"
            lines.append(f"| {level} | {text} | {turn.reply} | {longest} / {MAX_WORDS[level]}{flag} | ☐ |")
    path = OUT / "f3_level.md"
    path.write_text("\n".join(lines) + "\n")
    return path, over


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", default="fr", choices=["fr", "en"])
    a = ap.parse_args()
    OUT.mkdir(exist_ok=True)
    print("wrote", corrections_sheet(a.lang))
    path, over = level_sheet()
    print(f"wrote {path} ({over} replies with a sentence above the level limit)")
    tracing.flush()


if __name__ == "__main__":
    main()
