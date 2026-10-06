"""Try the coach in a terminal, without the API or the app.

    python -m tkallem_agent.chat                                   # visa interview, B1, explanations in French
    python -m tkallem_agent.chat --scenario free-talk --level A2 --lang en
    python -m tkallem_agent.chat --list

Type your answers. /end shows the session report, /quit leaves without it. LLM keys are read from the
environment, or from apps/api/.env when python-dotenv is installed.
"""
import argparse
import os
import re
import sys
from pathlib import Path

from . import tracing
from .levels import MAX_WORDS
from .scenarios import list_scenarios
from .session import AgentError, CoachSession

USE_COLOR = sys.stdout.isatty() and not os.getenv("NO_COLOR")


def paint(text: str, code: str) -> str:
    return f"\x1b[{code}m{text}\x1b[0m" if USE_COLOR else text


COLORS = {"green": "32", "orange": "33", "red": "31"}
SENTENCE = {"green": "Clean", "orange": "{n} fix(es)", "red": "Redo"}  # DESIGN.md: color + word, never color alone
METRIC = {"green": "on track", "orange": "to work on", "red": "priority"}


def status_label(status: str | None, n: int) -> str:
    return paint(SENTENCE[status].format(n=n), COLORS[status]) if status else "n/a"


def metric_label(status: str | None) -> str:
    return paint(METRIC[status], COLORS[status]) if status else "n/a"


def mark(sentence: str, corrections: list[dict]) -> tuple[str, str]:
    """Student sentence with wrong parts struck in red, and the corrected sentence with fixes in green."""
    before, after = sentence, sentence
    for c in corrections:
        pattern = re.compile(re.escape(c["original"]), re.I)
        if USE_COLOR:
            before = pattern.sub(lambda m: paint(m.group(0), "9;31"), before, count=1)
            after = pattern.sub(lambda m: paint(c["fixed"], "1;32"), after, count=1)
        else:  # no color: Markdown-like marks keep the correction visible
            before = pattern.sub(lambda m: f"~~{m.group(0)}~~", before, count=1)
            after = pattern.sub(lambda m: f"**{c['fixed']}**", after, count=1)
    return before, after


def load_env() -> None:
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    env = Path(__file__).resolve().parents[3] / "apps" / "api" / ".env"
    load_dotenv(env if env.exists() else None)  # never overrides variables already set


def print_report(session: CoachSession) -> None:
    report = session.end()
    print("\n" + paint("=== Session report ===", "1"))
    for i, line in enumerate(report.lines):
        if line["role"] == "coach":
            print(paint(f"  coach: {line['text']}", "2"))
            continue
        redo = paint("  <- redo this one", "31") if i == report.redo_index else ""
        print(f"  you:   {line['text']}   [{status_label(line['status'], len(line['corrections']))}]{redo}")
    m, lv = report.metrics, report.levels
    print()
    print(f"  mistakes per 100 words: {m['mistakes_per_100']}  [{metric_label(lv['mistakes_per_100'])}]")
    print(f"  words per answer:       {m['words_per_answer']}  [{metric_label(lv['words_per_answer'])}]")
    hes = m["hesitations_per_min"]
    print(f"  hesitations per minute: {hes if hes is not None else 'n/a (typed answers)'}  [{metric_label(lv['hesitations_per_min'])}]")
    print("\n" + paint("Coach note: ", "1") + report.note)
    print(paint(f"(report in {session.last_timings['report']:.1f}s)", "2"))


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Practice with the Tkallem coach in the terminal.")
    ap.add_argument("--scenario", default="visa-us")
    ap.add_argument("--level", default="B1", choices=list(MAX_WORDS))
    ap.add_argument("--lang", default="fr", choices=["fr", "en"], help="language of the explanations")
    ap.add_argument("--list", action="store_true", help="list the scenarios and exit")
    args = ap.parse_args(argv)

    if args.list:
        for s in list_scenarios():
            print(f"{s.id:15} {s.title} ({s.mode}{f', {s.minutes} min' if s.minutes else ''})")
        return 0

    load_env()
    session = CoachSession(args.scenario, args.level, args.lang)
    print(paint(f"{session.scenario.title} · Coach at {args.level} · explanations in {args.lang}", "1"))
    print(paint("Type your answer. /end for your report, /quit to leave.\n", "2"))
    print(f"coach> {session.opening}")

    while True:
        try:
            line = input("you>   ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break
        if line == "/quit":
            tracing.flush()
            return 0
        if line == "/end":
            break
        if not line:
            continue
        try:
            turn = session.turn(line)
        except ValueError as e:
            print(paint(f"  ! {e}", "31"))
            continue
        except AgentError as e:
            print(paint(f"  ! the coach could not answer, try again ({e})", "31"))
            continue
        corrections = [c.model_dump() for c in turn.corrections]
        if corrections:
            before, after = mark(line, corrections)
            print(f"       {before}\n       {after}")
            for c in corrections:
                print(paint(f"       {c['why']}", "2"))
        print(f"       [{status_label(turn.sentence_status, len(corrections))}]")
        t = session.last_timings
        print(f"coach> {turn.reply}  " + paint(f"({t['total']:.1f}s)", "2"))
        if session.finished:
            print(paint("(all questions answered: /end for your report)", "2"))

    if session.turns:
        try:
            print_report(session)
        except AgentError as e:
            print(paint(f"  ! report failed: {e}", "31"))
    tracing.flush()
    return 0


if __name__ == "__main__":
    sys.exit(main())
