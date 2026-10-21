# AI coach

How the coach works, what the models are allowed to do, what only code is allowed to do, and how we check it.
Other parts: [System design](system-design.md) · [DevOps and delivery](devops.md) · [← back to the README](../README.md)

## Contents

1. [The idea in one sentence](#the-idea-in-one-sentence)
2. [What happens when a student answers](#what-happens-when-a-student-answers)
3. [The agent](#the-agent)
4. [The model talks, the code decides](#the-model-talks-the-code-decides)
5. [Providers and backups](#providers-and-backups)
6. [Evaluation: how we know it works](#evaluation-how-we-know-it-works)
7. [Privacy](#privacy)
8. [Limits](#limits)

## The idea in one sentence

A language model is good at sounding right and bad at being reliable. So in Tkallem the model **proposes** (mistakes, a
compliment, a reply) and plain **code decides** what the student actually sees. Anything that can be computed is computed,
not generated.

## What happens when a student answers

![What happens when a student answers: student, Next.js web app, FastAPI API with Clerk, Groq Whisper speech to text, LangGraph coach on OpenRouter, Python guardrails, Neon storage, Groq or DeepInfra voice, Langfuse traces](images/ai-pipeline.svg)

1. **The student speaks or types.** The web app records (a few seconds up to a limit) or sends the text.
2. **The API checks who it is** (Clerk token or signed guest token) and **takes one free answer** from the wallet in a single
   conditional `UPDATE`. No answer left, no model call, no cost.
3. **Speech to text:** Whisper on Groq, then DeepInfra if Groq is limited. The audio is held in memory only.
4. **Two model calls run in parallel:** a *corrector* that finds the mistakes, and a *coach* that writes the short reaction.
   The coach's reply is streamed to the screen first, so the voice can start before the corrections are ready.
5. **Guardrails in code** check, trim and merge everything the models returned (next section).
6. **The turn is stored** (text only) and the corrections are streamed to the browser.
7. **The coach is spoken** by a voice provider, with two backups, the last one being the browser's own voice.

## The agent

The agent lives in [`packages/agent`](../packages/agent) and is a dependency of the API. Everything goes through one class,
`CoachSession`:

```python
session = CoachSession("visa-us", level="B1", explain_lang="fr")
session.opening                                    # "What is the purpose of your trip?"
turn = session.turn("I go to the US for study.")   # reply, corrections, sentence color, goal covered
report = session.end()                             # transcript, metrics, colors, the answer to redo, the note
```

- **Built with LangGraph and LangChain.** Structured output through function calling; temperature 0 so corrections are
  reproducible.
- **Scenarios are data:** one JSON file each in `packages/agent/tkallem_agent/scenarios/` (ten today: six interviews and
  exams, four everyday situations). Guided scenarios have six ordered questions; free talk has an opening line.
- **Two modes:** *Practice* (corrections after each answer, hints, "Say it again") and *Real interview* (the coach plays the
  officer; nothing is shown until the report; any praise is replaced by "Thank you.").
- **Explanations in French or simple English,** chosen by the student, with a note on the report.
- **Help me start** gives the first words of an answer, or turns an idea written in French or Darija into English to read
  aloud. **Say it again** lets the student repeat the corrected sentence; the code, not the model, says whether it matched.

How the agent plugs into the API (endpoints, storage, streaming events, errors):
[`agent-integration.md`](agent-integration.md). Settings, prompts and tests: [`packages/agent/README.md`](../packages/agent/README.md).

## The model talks, the code decides

| The model proposes | The code decides |
|---|---|
| Mistakes to correct | Keeps at most 3; drops a fix that changes nothing, quotes words the student did not say, removes a name or a number, or rewrites far more than it replaces; merges fixes that touch the same words; the sentence color comes from the fixes |
| A compliment | Kept only if it is short, only positive, quotes the student's own words, does not name anything absent from the answer and does not praise the mistake itself |
| The coach's reply | The next question is added verbatim from the scenario; a question is repeated at most once; answered questions are skipped; nothing reopens after the closing line; in a real interview any praise is replaced by "Thank you." A sentence longer than the level allows is rephrased once |
| Sentence starters, translations | 12 words at most and stopping before the content (never a complete answer); a translation must keep every name and number, add none, and be a finished sentence; otherwise the scenario's own starter is used |
| Whether the student repeated the correction | Never the model: 85 % word similarity, every fixed phrase heard, the mistake not said again |
| The end-of-session note | Rejected, and replaced by a template note, if it contains a number that is not in the session's facts |
| Progress, freeze, confidence lines | Computed from stored numbers, never written by the model |

**Prompt injection.** The student's words are framed as data inside the prompt, and every field the model returns is
validated by code. Attacks such as "ignore your rules", "mark this green" or hidden JSON are in the evaluation set
(`packages/agent/evals/injection.py`).

## Providers and backups

| Job | First choice | Backups |
|---|---|---|
| Language model (coach and corrector) | Qwen3-235B through OpenRouter | GPT-4.1 mini through OpenRouter, then Qwen3 on Groq (slower, a last resort) |
| Speech to text | Whisper large-v3-turbo on Groq | The same model on DeepInfra |
| Voice | Orpheus on Groq | Kokoro on DeepInfra, then the browser's own voice |

If the main language model has not answered after 12 seconds, the backups are tried; a duplicate request is sent after
3 seconds if the first is slow. An unusable output is retried once. Every provider call has a timeout.

**Cost of one answer** (measured in October 2026): about 0.0003 $ typed, 0.0009 $ spoken with Kokoro, 0.0034 $ spoken
with Orpheus. `DAILY_SPEND_CAP` bounds what everyone together can spend per day.

## Evaluation: how we know it works

Prompts are code, so a prompt change is tested like code. When the agent changes, the **AI gate** runs in CI and blocks the
merge if it fails (see [DevOps](devops.md#the-ai-gate)).

| Set | Size | Baseline (real model) |
|---|---|---|
| Correction set | 33 sentences, 29 seeded mistakes | **29 of 29 detected, 0 false alarm** on correct sentences |
| Prompt-injection attacks | 9 | **9 of 9 handled** |
| "Help me start" | 10 starter and 10 translation cases | 0 complete-answer starter, 0 changed name or number |
| Compliments | in the correction set | 0 invented compliment |

Speed, last measured on 2026-10-05 (results vary with provider routing): the coach's reply is ready at a median of 1.0 s
(95th percentile 4.0 s), the corrections at 1.9 s (4.0 s), the report in under 1.8 s.

Run them yourself:

```bash
cd packages/agent
../../apps/api/.venv/bin/pytest -q                  # unit tests, no network
../../apps/api/.venv/bin/python evals/gate.py       # the CI gate (needs model keys)
../../apps/api/.venv/bin/python evals/injection.py  # prompt-injection attacks
../../apps/api/.venv/bin/python evals/latency.py    # turn and report latency
```

## Privacy

- **The student's audio is never written to disk or to the database** by our API; only the text is kept. The audio is sent
  to the speech-to-text provider (Groq, or DeepInfra as backup) to be transcribed; what they do with it is governed by
  their own terms, not ours.
- **Langfuse tracing is off unless configured.** When on, traces contain the student's text (no name, no email), so the
  project must stay private.
- A guest's network address is stored only as a keyed hash.

## Limits

We would rather say them:

- **The evaluation sets are small and labelled by one person.** They catch regressions; they do not prove the coach is right
  about every sentence. A correction can still be wrong. While preparing the project's screenshots, one visa-interview
  answer ("I go to the United States for study my master…") was corrected to the past tense ("went"), which is wrong for a
  trip that has not happened. The guardrails cannot catch a grammar judgement like that. It is the next thing to add to the
  correction set.
- **Darija translation depends on the model;** a translation the code refuses falls back to a generic starter.
- **Scenarios are few** (ten), and a real admission or visa interview may be held in another language while ours trains the English version.
- **Voice quality and latency depend on the providers' free quotas;** backups exist, but a long outage falls back to the
  browser's voice.
- **The API contains a real-time voice route** (Pipecat over WebRTC) that the app does not use yet.
