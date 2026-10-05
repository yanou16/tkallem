"""CEFR estimator test (F10). Gate from the spec: > 85% correct within one level on oral transcripts of known level.

Usage:
  python evals/cefr/run_cefr_eval.py [llm]              # zero-shot LLM baseline (needs LLM env vars)
  python evals/cefr/run_cefr_eval.py hf                 # fine-tuned model via its Hugging Face Space
  add --data real_testers.json to use real samples (see import_samples.py)
  python evals/cefr/run_cefr_eval.py mypkg.mod:func     # your own estimator: a function str -> "B1"
"""
import importlib
import json
import sys
from collections import Counter
from pathlib import Path

from tkallem_agent.cefr import ORDER, clamp, distance, hf_space_estimator, llm_estimator
from tkallem_agent.llm import get_llm

DATA = Path(__file__).parent / "transcripts.json"  # override with --data
GATE = 0.85


def load_estimator(spec: str | None):
    if not spec or spec == "llm":
        return llm_estimator(get_llm())
    if spec == "hf":  # the fine-tuned model, via its Hugging Face Space
        return hf_space_estimator()
    mod, fn = spec.split(":")
    return getattr(importlib.import_module(mod), fn)


def main() -> int:
    args = sys.argv[1:]
    data = DATA
    if "--data" in args:
        i = args.index("--data")
        data = Path(args[i + 1])
        args = args[:i] + args[i + 2:]
    estimate = load_estimator(args[0] if args else None)
    rows = json.loads(data.read_text())
    print(f"dataset: {data.name} ({len(rows)} samples)")
    conf: Counter = Counter()
    exact = within1 = exact_clamped = errors = 0
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
        exact_clamped += clamp(guess) == r["level"]
        within1 += d <= 1
        print(f"{r['id']:7} true={r['level']} guess={guess} {'ok' if d == 0 else 'off by %d' % d}")
    n = len(rows)
    print("\nconfusion (rows = true level, columns = estimated):")
    print("      " + " ".join(f"{g:>3}" for g in ORDER))
    for t in ORDER:
        if any(conf[(t, g)] for g in ORDER):
            print(f"  {t}  " + " ".join(f"{conf[(t, g)]:>3}" for g in ORDER))
    print(f"\nexact {exact}/{n} = {exact / n:.0%} | within one level {within1}/{n} = {within1 / n:.0%} (gate {GATE:.0%}) | errors {errors}")
    print(f"exact once clamped to the app's A2-C1 scale: {exact_clamped}/{n} = {exact_clamped / n:.0%}")
    if all(str(r.get("source", "")).startswith("synthetic") for r in rows):
        print("NOTE: transcripts are synthetic. Validate on real learner speech before trusting the gate.")
    return 0 if within1 / n > GATE else 1


if __name__ == "__main__":
    sys.exit(main())
