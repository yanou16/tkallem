# tkallem-agent

The AI coach of Tkallem: it plays the scenario, corrects the student's English, explains each mistake (French or
simple English) and writes the end-of-session note. Principle: **the model talks, the code decides**: the next
question, the sentence color, the progress numbers and which corrections are kept are computed by code.

## Use it

```python
from tkallem_agent import CoachSession

session = CoachSession("visa-us", level="B1", explain_lang="fr")
session.opening                                   # "What is the purpose of your trip?"
turn = session.turn("I go to the US for study.")  # AgentTurn: reply, corrections, sentence_status, goal_covered
report = session.end()                            # Report: transcript, metrics, colors, redo_index, note
```

The API integration (endpoints, storage, errors, streaming) is described in [`docs/agent-integration.md`](../../docs/agent-integration.md).

Try it in a terminal, no API or app needed:

```bash
cd packages/agent
../../apps/api/.venv/bin/python -m tkallem_agent.chat --scenario visa-us --level B1 --lang fr
../../apps/api/.venv/bin/python -m tkallem_agent.chat --list
```

## How a turn works

```
student text ─┬─► corrector (LLM, strict) ─┬─► guardrails ─► AgentTurn
              └─► coach     (LLM, reply)  ─┘
```

- The two calls run in parallel. `turn_events()` yields the coach reply first, so the voice can start before the
  corrections are ready.
- A call still running after `TKALLEM_HEDGE_AFTER` seconds gets one duplicate request; the first answer wins.
- Guardrails (`schemas.sanitize`): a correction is dropped if it is malformed, changes nothing, quotes words that are not
  in the student's text, removes a name or a number, or rewrites far more than it fixes. Max 3. The color comes from
  the corrections. Goal ids must come from the scenario.
- Guided mode: the model writes one short reaction; the code appends the next scenario question verbatim.
- The coach is asked once to rephrase a sentence longer than the level allows (`levels.MAX_WORDS`).
- The report note is rejected (template note instead) if it contains a number that is not in the session facts.

## Scenarios

JSON files in [`scenarios/`](scenarios), validated by `scenarios.Scenario` (one goal id per question, file name = id).
`mode: "guided"` has 6 ordered questions; `mode: "free"` has an `opening` line and no fixed questions. Questions must
come from real sources and be reviewed by the team.

## Configuration (environment)

| Variable | Default | Role |
|---|---|---|
| `LLM_PROVIDER` | `openrouter` | `openrouter` or `groq` |
| `LLM_MODEL` | `qwen/qwen3-235b-a22b-2507` | model id at the provider |
| `OPENROUTER_API_KEY` / `GROQ_API_KEY` | | server-side only |
| `OPENROUTER_PROVIDER_SORT` | `latency` | OpenRouter routing (`latency`, `throughput`, `price`, empty = default) |
| `LLM_TEMPERATURE` | `0` | 0 keeps corrections reproducible |
| `LLM_TIMEOUT` / `LLM_MAX_RETRIES` | `20` / `1` | per request |
| `TKALLEM_HEDGE_AFTER` | `3` | seconds before a duplicate request, `0` disables |
| `TKALLEM_MAX_TEXT_CHARS` | `1000` | longest accepted answer |
| `TKALLEM_SCENARIOS_DIR` | `scenarios/` | other scenario folder |
| `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` / `LANGFUSE_HOST` | | tracing, off when unset |

## Tests and evaluations

```bash
cd packages/agent
../../apps/api/.venv/bin/pytest -q                     # unit tests, no network
set -a && source ../../apps/api/.env && set +a          # LLM keys for the evaluations below
../../apps/api/.venv/bin/python evals/run_evals.py      # 30-sentence correction set (EXPLAIN_LANG=en for English)
../../apps/api/.venv/bin/python evals/injection.py      # prompt-injection attacks
../../apps/api/.venv/bin/python evals/latency.py        # turn and report latency
../../apps/api/.venv/bin/python evals/review_sheet.py   # human review sheets (F3 level, F5 corrections)
../../apps/api/.venv/bin/python evals/cefr/run_cefr_eval.py hf   # CEFR estimator (F10), see docs/cefr-testers.md
```

Every prompt change must re-run `run_evals.py` (both languages) and `injection.py`.

Last results (2026-10-05, `qwen/qwen3-235b-a22b-2507` via OpenRouter):

| Check | Result | Target |
|---|---|---|
| Correction set, French explanations | 28/28 errors detected, 29/30 sentences exact, 0 false alarm | ≥ 85 %, 0 |
| Correction set, English explanations | 28/28 detected, 29/30 exact, 1 unnecessary style change | ≥ 85 %, 0 |
| Prompt injection | 9/9 attacks handled | all |
| Coach reply ready (voice can start) | p50 1.7 s, p95 2.4 s | 2.5 s (assumed share of the 4 s) |
| Corrections ready | p50 2.4 s, p95 6.9 s | shown after the reply starts |
| Report | max 3.1 s | < 5 s |
| Coach sentence length vs level (20 replies) | 0 above the limit | 0 |

Results vary between runs (provider routing): re-run before quoting them.
