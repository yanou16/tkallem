"""CEFR estimator test (F10). Gate from the spec: > 85% correct within one level on oral transcripts of known level.

Usage:
  python evals/cefr/run_cefr_eval.py                    # zero-shot LLM baseline (needs LLM env vars)
  python evals/cefr/run_cefr_eval.py mypkg.mod:func     # your own estimator: a function str -> "B1"
"""
import importlib
import json
import sys
from collections import Counter
from pathlib import Path

from tkallem_agent.cefr import ORDER, distance, llm_estimator
from tkallem_agent.llm import get_llm

DATA = Path(__file__).parent / "transcripts.json"
GATE = 0.85


def load_estimator(spec: str | None):
    if not spec:
        return llm_estimator(get_llm())
    mod, fn = spec.split(":")
    return getattr(importlib.import_module(mod), fn)


def main() -> int:
    estimate = load_estimator(sys.argv[1] if len(sys.argv) > 1 else None)
    rows = json.loads(DATA.read_text())
    conf: Counter = Counter()
    exact = within1 = errors = 0
    for r in rows:
        try:
            guess = estimate(r["text"])
        except Exception as e:  # count as a miss, keep going
            errors += 1
            print(f"{r['id']} ERROR {e}")
            continue
        conf[(r["level"], guess)] += 1
        d = distance(r["level"], guess)
        exact += d == 0
        within1 += d <= 1
        print(f"{r['id']:7} true={r['level']} guess={guess} {'ok' if d == 0 else 'off by %d' % d}")
    n = len(rows)
    print("\nconfusion (rows = true level, columns = estimated):")
    print("      " + " ".join(f"{g:>3}" for g in ORDER))
    for t in ORDER:
        if any(conf[(t, g)] for g in ORDER):
            print(f"  {t}  " + " ".join(f"{conf[(t, g)]:>3}" for g in ORDER))
    print(f"\nexact {exact}/{n} = {exact / n:.0%} | within one level {within1}/{n} = {within1 / n:.0%} (gate {GATE:.0%}) | errors {errors}")
    print("NOTE: transcripts are synthetic. Validate on real learner speech before trusting the gate.")
    return 0 if within1 / n > GATE else 1


if __name__ == "__main__":
    sys.exit(main())
