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
    ("renting-a-room", 0, "I'm a master's student in biology, I come from Algeria.", "introduce_yourself"),
    ("renting-a-room", 1, "For ten months, from September to June.", "length_of_stay"),
    ("renting-a-room", 1, "My budget is around 400 euros.", "budget"),
    ("renting-a-room", 2, "I can pay 350 euros a month.", "budget"),
    ("renting-a-room", 2, "Sorry, how much is the rent?", None),
    ("renting-a-room", 3, "Are the bills included in the rent?", "ask_about_bills"),
    ("renting-a-room", 4, "Yes, that is fine, I can pay the deposit.", "deposit"),
    ("renting-a-room", 5, "I could move in on the first of September.", "move_in_date"),
    ("renting-a-room", 1, "Sorry, can you repeat the question?", None),
    ("renting-a-room", 0, "Hello, how are you?", None),
    ("university-admission", 1, "I applied because the program is strong in artificial intelligence.", "chosen_program"),
    ("university-admission", 3, "I chose this university for its research lab, and this country for its quality of life.", "why_this_university"),
    ("university-admission", 4, "I built a voice assistant with two classmates for my final project.", "proud_experience"),
    ("university-admission", 5, "I would like to become a researcher in data science.", "career_plan"),
    ("university-admission", 2, "What do you mean by connect?", None),
    ("visa-us", 1, "I will attend Georgia Tech for a master's in computer science.", "chosen_program"),
    ("visa-us", 2, "I have a Fulbright scholarship.", "funding"),
    ("visa-us", 4, "Je ne comprends pas la question.", None),
    ("visa-us", 0, "I go to the US for study.", "purpose_of_trip"),
    ("visa-us", 5, "I will come back to Algeria and work in a bank.", "plans_after"),
    ("visa-us", 3, "My father will pay everything.", "funding"),
]


# (scenario, question index, answer, goal expected in goal_covered or also_covered, the other one expected too)
DOUBLE = [
    ("renting-a-room", 0, "I am a student and I need the room for six months.", "introduce_yourself", "length_of_stay"),
    ("renting-a-room", 2, "About 400 euros, and yes, the deposit is fine.", "budget", "deposit"),
    ("visa-us", 1, "Georgia Tech, computer science, and I have a full scholarship.", "chosen_program", "funding"),
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
    both = 0
    for scenario_id, index, answer, first, second in DOUBLE:
        for _ in range(runs):
            s = at_question(scenario_id, index)
            s.turn(answer)
            got = {s.turns[-1].goal_covered, *s.turns[-1].also_covered}
            ok = {first, second} <= got
            both += ok
            print(f"{'OK ' if ok else 'BAD'} [{scenario_id} q{index}] two goals {answer!r}: got {sorted(g for g in got if g)}")
    print(f"answers covering two questions: both goals found {both}/{len(DOUBLE) * runs}")
    print(
        f"\nSUMMARY {results['ok']}/{results['total']} | answered the asked question {results['asked_ok']}/{results['asked_total']}"
        f" | answered another question {results['other_ok']}/{results['other_total']}"
        f" | did not answer (null) {results['none_ok']}/{results['none_total']}"
    )


if __name__ == "__main__":
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 2)
