""""Help me start" eval (docs/JURY_BRIEF.md, improvement 1): 10 starter cases and 10 translation cases (French and
Darija), on the real model. Needs LLM env vars.

What the code guarantees whatever the model says (tests/test_hints.py): no starter that is a complete answer or longer
than 12 words reaches the student, no translation that changes a name or a number does. What this script measures:
how often the model's own proposal passes those checks (when it does not, the student gets the scenario's starter,
which is safe but generic), and it prints every output for a human to check the meaning.
Usage: python evals/hints.py
"""
import sys
from pathlib import Path

from tkallem_agent.hints import (
    pick_starters, propose_english, propose_starters, starter_problem, translation_problem,
)
from tkallem_agent.llm import default_llm
from tkallem_agent.scenarios import load_scenario

sys.path.insert(0, str(Path(__file__).parent))
from outage import retry_outage  # noqa: E402

# (scenario, question index, level)
STARTER_CASES = [
    ("visa-us", 0, "B1"), ("visa-us", 1, "B1"), ("visa-us", 2, "A2"), ("visa-us", 3, "B1"), ("visa-us", 4, "B2"),
    ("visa-us", 5, "A2"), ("campus-france", 1, "B2"), ("campus-france", 4, "B1"), ("job-remote", 1, "B2"),
    ("ielts-part2", 0, "B2"),
]
# (scenario, question index, level, the student's idea): names and numbers to keep in every case.
TRANSLATION_CASES = [
    ("visa-us", 1, "B1", "Je vais étudier l'informatique à Ohio State University pendant 2 ans."),
    ("visa-us", 2, "B1", "Mon père paie mes études, il gagne 120000 dinars par mois."),
    ("campus-france", 4, "B2", "J'ai une bourse de 615 euros par mois donnée par Campus France."),
    ("job-remote", 2, "B2", "J'ai créé une application pour la pharmacie Benali à Oran avec 3 amis."),
    ("visa-us", 5, "A2", "Après mon master je rentre en Algérie pour travailler chez Sonatrach."),
    ("visa-us", 0, "A2", "nroh l Amrika bach nqra master f data science"),
    ("visa-us", 4, "B1", "3andi familti f Oran w ana nkhdem m3a baba f l'entreprise ta3o"),
    ("visa-business", 1, "B1", "nb9a 10 jours f New York w nwelli"),
    ("campus-france", 3, "B2", "khtart France 3la khater les études mlah w l'master ta3hom m3rouf"),
    ("job-remote", 3, "B2", "nkhdem men dar men 9 sbah hta 5 l3chiya w nhadar m3a l'équipe f Slack"),
]


def context_of(sc) -> str:
    return " ".join([sc.title, sc.description, sc.coach_role, *sc.questions])


def evaluate() -> dict:
    llm = default_llm()
    starters_ok = complete = 0
    print("STARTERS")
    for sid, i, level in STARTER_CASES:
        sc = load_scenario(sid)
        q = sc.questions[i]
        try:
            proposed = retry_outage(f"{sid}#{i}", lambda: propose_starters(llm, q, level))
        except Exception as e:  # provider still down: counted as refused, the student would get the scenario starter
            proposed = []
            print(f"  ERROR {sid}#{i}: {type(e).__name__}")
        kept = pick_starters(proposed, q, context_of(sc))
        shown = kept or [sc.starters[i]]
        complete += sum(starter_problem(s, q, context_of(sc)) is not None for s in shown)
        starters_ok += bool(kept)
        print(f"  {'OK ' if kept else 'FALLBACK'} [{sid} {level}] {q}")
        for s in proposed:
            problem = starter_problem(s, q, context_of(sc))
            print(f"      {'kept   ' if problem is None else 'refused'} {s!r}{'' if problem is None else ' (' + problem + ')'}")
    translations_ok = changed = 0
    print("\nTRANSLATIONS")
    for sid, i, level, idea in TRANSLATION_CASES:
        q = load_scenario(sid).questions[i]
        try:
            english = retry_outage(f"{sid}#{i}", lambda: propose_english(llm, idea, q, level))
        except Exception as e:
            english = ""
            print(f"  ERROR {sid}#{i}: {type(e).__name__}")
        problem = translation_problem(idea, english)
        translations_ok += problem is None
        shown = english if problem is None else None  # refused: the student gets the scenario starter instead
        changed += shown is not None and translation_problem(idea, shown) is not None
        print(f"  {'OK ' if problem is None else 'FALLBACK'} [{level}] {idea}\n      -> {english}"
              f"{'' if problem is None else '  (' + problem + ')'}")
    n_s, n_t = len(STARTER_CASES), len(TRANSLATION_CASES)
    print(f"\nSUMMARY starters accepted {starters_ok}/{n_s} | complete-answer starters shown {complete} (0) | "
          f"translations accepted {translations_ok}/{n_t} | changed names or numbers shown {changed} (0)")
    return {"starters_ok": starters_ok, "starters": n_s, "complete": complete,
            "translations_ok": translations_ok, "translations": n_t, "changed": changed}


def main() -> int:
    m = evaluate()
    return 0 if m["complete"] == 0 and m["changed"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
