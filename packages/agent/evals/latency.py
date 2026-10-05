"""Agent latency on a real session (needs LLM env vars).

Spec targets: F4, < 4 s from the end of the student's speech to the start of the coach's audio (Whisper + agent + TTS).
The voice can start at "reply ready" (CoachSession.turn_events yields the coach reply before the corrections), so the
budget applies to that time; "total" is when the corrections are also ready.
F7, report shown < 5 s after the session ends. AGENT_BUDGET is our share of the 4 s, an assumption that leaves
about 1.5 s for speech-to-text and text-to-speech: adjust it once the voice pipeline is measured.

Usage: python evals/latency.py [--scenario visa-us] [--level B1] [--runs 2]
"""
import argparse
import statistics
import sys

from tkallem_agent import CoachSession, tracing

AGENT_BUDGET = 2.5
REPORT_BUDGET = 5.0
ANSWERS = {
    "guided": [
        "I go to the US for study.",
        "I will study computer science at Georgia Tech.",
        "I have scholarship of DAAD and my father pay the rest.",
        "Because the universities there is very good for artificial intelligence.",
        "My family is in Algiers and I have a house there.",
        "After my master I will return to Algeria and work in a company.",
    ],
    "free": [
        "Today I wake up very late and I miss the bus.",
        "At work my manager is angry because I arrive late to the meeting.",
        "I think I will buy a alarm clock.",
        "Tomorrow I go to sleep early.",
    ],
}


def pct(values: list[float], p: float) -> float:
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, round(p * (len(ordered) - 1)))]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--scenario", default="visa-us")
    ap.add_argument("--level", default="B1")
    ap.add_argument("--runs", type=int, default=2)
    a = ap.parse_args()

    totals, replies, sequential, reports = [], [], [], []
    for run in range(a.runs):
        s = CoachSession(a.scenario, a.level)
        for text in ANSWERS[s.scenario.mode]:
            s.turn(text)
            t = s.last_timings
            totals.append(t["total"])
            replies.append(t.get("reply_ready", t["total"]))
            sequential.append(t.get("correct", 0) + t.get("coach", 0))
            print(
                f"run {run + 1} | reply ready {t.get('reply_ready', 0):.2f}s | total {t['total']:.2f}s | corrector {t.get('correct', 0):.2f}s | "
                f"coach {t.get('coach', 0):.2f}s ({t.get('coach_attempts', 1)} call) | {text[:40]}"
            )
        s.end()
        reports.append(s.last_timings["report"])
        print(f"run {run + 1} | report {reports[-1]:.2f}s")
    tracing.flush()

    p50, p95 = statistics.median(replies), pct(replies, 0.95)
    print(
        f"\nreply ready: p50 {p50:.2f}s, p95 {p95:.2f}s (agent budget {AGENT_BUDGET}s) | "
        f"with corrections: p50 {statistics.median(totals):.2f}s, p95 {pct(totals, 0.95):.2f}s | "
        f"same calls one after the other: p50 {statistics.median(sequential):.2f}s | "
        f"report: max {max(reports):.2f}s (budget {REPORT_BUDGET}s)"
    )
    return 0 if p95 <= AGENT_BUDGET and max(reports) <= REPORT_BUDGET else 1


if __name__ == "__main__":
    sys.exit(main())
