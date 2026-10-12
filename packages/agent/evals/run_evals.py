"""Run the 30-sentence correction set against the agent. Re-run after every prompt or model change.

Targets: errors detected >= 85%, harmful corrections = 0, false alarms on clean sentences = 0, invalid outputs = 0.
"harmful" = the corrections, once applied, give a sentence that is neither the original nor an accepted correct sentence
(wrong fix, incomplete fix, or a new fault). Read the printed corrections too: the explanations (why) need a human eye.
Usage: python evals/run_evals.py   (needs LLM env vars)
"""
import json
import os
import re
import sys
from pathlib import Path

from tkallem_agent.graph import build_graph
from tkallem_agent.llm import get_llm
from tkallem_agent.scenarios import load_scenario

sys.path.insert(0, str(Path(__file__).parent))
from outage import retry_outage  # noqa: E402

ROOT = Path(__file__).parent
SCENARIO = load_scenario("visa-us").model_dump()
STOP = {"the", "a", "an", "to", "i", "my"}


def norm(s: str) -> str:
    return " ".join(re.sub(r"[.,!?;:]", " ", s.lower()).split())


def toks(s: str) -> set[str]:
    return set(norm(s).split()) - STOP


def detected(expected: dict, corrections) -> bool:
    """An error counts as found if a correction touches the same words (before or after the fix)."""
    return any(
        toks(expected["wrong"]) & toks(c.original) or toks(expected["fixed"]) & toks(c.fixed) for c in corrections
    )


def apply(sentence: str, corrections) -> str:
    s = sentence
    for c in corrections:
        if norm(c.original) == norm(s):
            s = c.fixed
        else:
            s = re.sub(re.escape(c.original.rstrip(".")), c.fixed.rstrip("."), s, count=1, flags=re.I)
    return s


def evaluate() -> dict:
    """Runs the correction set once, prints each sentence, returns the counts (used by main and by evals/gate.py)."""
    graph = build_graph(get_llm())
    rows = json.loads((ROOT / "correction_set.json").read_text())
    total = found = exact = harmful = false_alarms = invalid = reds = 0
    rule_ok = rule_checked = rule_missing = 0
    for r in rows:
        state = {"level": r["level"], "scenario": SCENARIO, "student_text": r["sentence"], "history": [],
                 "explain_lang": os.getenv("EXPLAIN_LANG", "fr")}
        try:
            out = retry_outage(r["id"], lambda: graph.invoke(state))
        except Exception as e:  # provider still down after the retries, or another error: the row is invalid
            out = {"error": f"{type(e).__name__}: {e}"}
        turn = out.get("turn")
        if turn is None:
            invalid += 1
            print(f"{r['id']} INVALID OUTPUT: {str(out.get('error'))[:120]}")
            continue
        total += len(r["errors"])
        found += sum(detected(e, turn.corrections) for e in r["errors"])
        for c in turn.corrections:  # `rule` (Top mistakes screen): compared with the label of the error it fixes
            matched = {e["rule"] for e in r["errors"] if detected(e, [c])}
            if matched:
                rule_checked += 1
                rule_missing += c.rule is None
                rule_ok += c.rule in matched
        result = apply(r["sentence"], turn.corrections)
        ok = norm(result) in {norm(a) for a in r["accepted"]}
        changed = norm(result) != norm(r["sentence"])
        exact += ok
        bad = changed and not ok
        harmful += bad
        false_alarms += bool(not r["errors"] and changed)
        tag = "OK " if ok else ("BAD" if bad else "MISS")
        reds += turn.sentence_status == "red"
        print(f"{r['id']} {tag} [{turn.sentence_status}] | {r['sentence']} -> {result}")
        for c in turn.corrections:
            print(f"      {c.original!r} -> {c.fixed!r} | {c.why}")
    rate = found / total if total else 0
    print(
        f"\nSUMMARY detected {found}/{total} = {rate:.0%} (>=85%) | exact {exact}/{len(rows)} | "
        f"harmful {harmful} (0) | false alarms {false_alarms} (0) | invalid {invalid} (0) | red {reds}"
    )
    print(f"RULE (informative, labels are one person's judgment) correct {rule_ok}/{rule_checked}, missing {rule_missing}")
    return {"found": found, "total": total, "exact": exact, "rows": len(rows), "harmful": harmful,
            "false_alarms": false_alarms, "invalid": invalid, "red": reds}


def main() -> int:
    m = evaluate()
    rate = m["found"] / m["total"] if m["total"] else 0
    return 0 if rate >= 0.85 and m["harmful"] == 0 and m["false_alarms"] == 0 and m["invalid"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
