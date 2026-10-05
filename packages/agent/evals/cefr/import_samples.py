"""Turn a table of real samples into a CEFR test set for run_cefr_eval.py.

Input: CSV with a level column and a text column (names configurable). Output: JSON in the same format as transcripts.json.
Real data is personal or licensed (Speak & Improve forbids sharing): the output stays local and is git-ignored.

  python evals/cefr/import_samples.py data/testers.csv --source testers
  python evals/cefr/import_samples.py data/icnale.csv --level-col cefr --text-col transcript --source icnale
  python evals/cefr/run_cefr_eval.py hf --data evals/cefr/real_testers.json
"""
import argparse
import csv
import json
import re
from pathlib import Path

LEVELS = {"A2", "B1", "B2", "C1"}  # the levels the app supports


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("csv_path")
    ap.add_argument("--level-col", default="level")
    ap.add_argument("--text-col", default="text")
    ap.add_argument("--source", required=True, help="short name, used in the output file name")
    ap.add_argument("--min-words", type=int, default=15)
    ap.add_argument("--max-per-level", type=int, default=0, help="0 = no cap; caps keep levels balanced")
    a = ap.parse_args()

    rows, seen, skipped = [], set(), {"level": 0, "short": 0, "duplicate": 0}
    per_level: dict[str, int] = {}
    with open(a.csv_path, newline="", encoding="utf-8") as f:
        for i, r in enumerate(csv.DictReader(f)):
            level, text = r[a.level_col].strip().upper(), " ".join(r[a.text_col].split())
            if level not in LEVELS:
                skipped["level"] += 1
                continue
            if len(re.findall(r"[A-Za-z']+", text)) < a.min_words:
                skipped["short"] += 1
                continue
            if text.lower() in seen:
                skipped["duplicate"] += 1
                continue
            if a.max_per_level and per_level.get(level, 0) >= a.max_per_level:
                continue
            seen.add(text.lower())
            per_level[level] = per_level.get(level, 0) + 1
            rows.append({"id": f"{a.source}-{i + 1}", "level": level, "text": text, "source": a.source})
    out = Path(__file__).parent / f"real_{a.source}.json"
    out.write_text(json.dumps(rows, indent=2, ensure_ascii=False))
    print(f"{len(rows)} samples -> {out.name} | per level {dict(sorted(per_level.items()))} | skipped {skipped}")


if __name__ == "__main__":
    main()
