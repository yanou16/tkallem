"""How reliably the coach reports which scenario goal an answer covered (`goal_covered`).

The code uses it to move through the interview: a question already answered earlier is skipped, and a question the
student did not answer (clarification request, off-topic, answering another question) is asked once more. A wrong
`goal_covered` would skip a question or repeat one, so it is measured here before relying on it.

    cd packages/agent && set -a && source ../../apps/api/.env && set +a
    ../../apps/api/.venv/bin/python evals/goals.py [runs]
"""
import sys
from collections import Counter

from tkallem_agent import CoachSession
from tkallem_agent.scenarios import load_scenario
from tkallem_agent.session import TurnLog

# (scenario, index of the question being asked, student answer, expected goal id or None)
CASES = [
    ("visa-business", 0, "I'm going to a medical conference in Boston.", "purpose_of_trip"),
    ("visa-business", 1, "Two weeks, from the 3rd to the 17th of March.", "length_of_stay"),
    ("visa-business", 1, "I am a software developer in Algiers.", "occupation"),
    ("visa-business", 2, "I work as a nurse at Mustapha hospital.", "occupation"),
    ("visa-business", 2, "I'm a student at USTHB, in computer science.", "occupation"),
    ("visa-business", 3, "My employer pays for the flight and the hotel.", "funding"),
    ("visa-business", 3, "I will stay ten days only.", "length_of_stay"),
    ("visa-business", 4, "Yes, I went to France and Turkey last year.", "travel_history"),
    ("visa-business", 5, "What do you mean by ties?", None),
    ("visa-business", 5, "My wife and children live in Oran and I have a permanent job.", "ties_to_algeria"),
    ("visa-business", 1, "Sorry, can you repeat the question?", None),
    ("visa-business", 0, "Hello, how are you?", None),
    ("visa-us", 1, "I will attend Georgia Tech for a master's in computer science.", "chosen_program"),
    ("visa-us", 2, "I have a Fulbright scholarship.", "funding"),
    ("visa-us", 4, "Je ne comprends pas la question.", None),
    ("visa-us", 0, "I go to the US for study.", "purpose_of_trip"),
    ("visa-us", 5, "I will come back to Algeria and work in a bank.", "plans_after"),
    ("visa-us", 3, "My father will pay everything.", "funding"),
]


def at_question(scenario_id: str, index: int) -> CoachSession:
    """A session where the coach has just asked question `index` (earlier answers are placeholders)."""
    qs = load_scenario(scenario_id).questions
    s = CoachSession(scenario_id, "B1", "en")
    s.turns = [TurnLog(student_text="Okay.", reply=f"Thank you. {qs[i]}", corrections=[], status="green") for i in range(index)]
    return s


def main(runs: int = 2) -> None:
    results = Counter()
    for scenario_id, index, answer, expected in CASES:
        got = []
        for _ in range(runs):
            s = at_question(scenario_id, index)
            for ev in s.turn_events(answer):
                if ev["type"] == "done":
                    got.append(ev["turn"].goal_covered)
        ok = sum(g == expected for g in got)
        results["ok"] += ok
        results["total"] += runs
        kind = "none" if expected is None else ("other" if expected != load_scenario(scenario_id).goals[index] else "asked")
        results[f"{kind}_ok"] += ok
        results[f"{kind}_total"] += runs
        mark = "OK " if ok == runs else "BAD"
        print(f"{mark} [{scenario_id} q{index}] {answer!r}: expected {expected}, got {got}")
    print(
        f"\nSUMMARY {results['ok']}/{results['total']} | answered the asked question {results['asked_ok']}/{results['asked_total']}"
        f" | answered another question {results['other_ok']}/{results['other_total']}"
        f" | did not answer (null) {results['none_ok']}/{results['none_total']}"
    )


if __name__ == "__main__":
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 2)
