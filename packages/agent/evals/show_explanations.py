"""Print the French explanations (why_fr) for the correction set, then a mock visa interview.
For HUMAN review of explanation quality and coach level. Usage: python evals/show_explanations.py
"""
import json
from pathlib import Path

from tkallem_agent.graph import build_graph
from tkallem_agent.llm import get_llm

ROOT = Path(__file__).parent
SCENARIO = json.loads((ROOT.parents[2] / "apps/api/app/scenarios/visa-us.json").read_text())
ANSWERS = [
    "I go to the US for study. I want to do a master in computer science.",
    "My family support me but I have scholarship of DAAD.",
    "After my master I will return to Algeria because my family is there.",
]
SCENARIO = {**SCENARIO, "questions": SCENARIO["questions"]}


def main() -> None:
    graph = build_graph(get_llm())
    print("=== EXPLANATIONS (30-sentence set) ===")
    for r in json.loads((ROOT / "correction_set.json").read_text()):
        out = graph.invoke({"level": r["level"], "scenario": SCENARIO, "student_text": r["sentence"], "history": []})
        t = out.get("turn")
        print(f"\n{r['id']} [{r['level']}] {r['sentence']}")
        if t is None:
            print("  INVALID OUTPUT")
            continue
        for c in t.corrections:
            print(f"  - {c.original!r} -> {c.fixed!r} ({c.type})\n    FR: {c.why_fr}")
        if not t.corrections:
            print("  (no correction)")

    print("\n\n=== MOCK VISA INTERVIEW (level B1) ===")
    state = {"level": "B1", "scenario": SCENARIO, "history": []}
    for a in ANSWERS:
        out = graph.invoke({**state, "student_text": a})
        state["history"] = out["history"]
        t = out["turn"]
        print(f"\nSTUDENT: {a}")
        for c in t.corrections:
            print(f"  fix: {c.original!r} -> {c.fixed!r} | FR: {c.why_fr}")
        print(f"  status={t.sentence_status} goal={t.goal_covered}\nCOACH: {t.reply}")


if __name__ == "__main__":
    main()
