# Plugging the agent into the API

For the back (`apps/api`). The agent lives in `packages/agent` and is already a dependency of the API
(`-e ../../packages/agent` in `apps/api/requirements.txt`). Everything goes through one class: `CoachSession`.

```python
from tkallem_agent import AgentError, CoachSession, ScenarioNotFound, list_scenarios
```

## Endpoints

### `POST /sessions` (scenario_id, mode, explain_lang)

```python
session = CoachSession(body.scenario_id, level=profile.level, explain_lang=body.explain_lang or profile.explain_lang,
                       max_text_chars=settings.max_text_chars)     # one limit for the API and the agent
save(session_id=session.session_id, state=session.to_state())     # JSON column, or rebuild it from your tables
return {"session_id": session.session_id, "first_question": {"text": session.opening, "audio_url": tts(session.opening)}}
```

### `POST /sessions/{id}/turn` (audio or text)

```python
session = CoachSession.from_state(load_state(id), max_text_chars=settings.max_text_chars)
text, seconds = (whisper(audio), audio_duration) if audio else (body.text, None)   # delete the audio right after
turn = await session.aturn(text, audio_seconds=seconds)
save(id, session.to_state())          # + rows in turns / corrections (text only)
return {"transcript": text, "reply": turn.reply, "reply_audio_url": tts(turn.reply),
        "corrections": [c.model_dump() for c in turn.corrections], "sentence_status": turn.sentence_status}
```

- Pass `audio_seconds` only for spoken answers: hesitations per minute are computed only when every answer of the
  session was spoken.
- Faster voice: `session.turn_events(text)` yields `{"type": "reply"}` before `{"type": "corrections"}`, then
  `{"type": "done", "turn": ...}`. Start the TTS on the reply event and send the corrections when they arrive
  (Server-Sent Events). This changes the HTTP contract: agree on it first (`packages/contracts`).
  An `AgentError` can still arrive after the reply event (the corrector failed twice): the turn is not recorded, ask
  the student to repeat; the coach reacts again and asks the same next question.
- `session.last_timings` gives `reply_ready`, `total`, `correct`, `coach` in seconds: log them.

### `POST /sessions/{id}/end`

```python
report = await CoachSession.from_state(load_state(id)).aend()
save_metrics(id, report.metrics)      # session_metrics table, for GET /me/progress
return report.model_dump()            # lines, note, metrics (+ levels, redo_index, see below)
```

`GET /me/progress` is computed from the stored `session_metrics`, no LLM involved.

### Listing scenarios (not in the contract yet)

The front needs the cards (title, duration): `list_scenarios()` returns `id, title, mode, minutes`. A
`GET /scenarios` endpoint would need a contract change.

## Errors

| Exception | Meaning | HTTP |
|---|---|---|
| `ValueError` | empty or too long answer (> `max_text_chars`), unknown level or explain_lang | 422 |
| `ScenarioNotFound` | unknown scenario id | 404 |
| `AgentError` | LLM provider down, timeout, or unusable output twice (coach or corrector) | 502: the student can resend the same answer, nothing was recorded |

## Contract notes

- `explain_lang` and the field name `why` (instead of `why_fr`) come from contract PR #3: merge it before relying on them.
- `sentence_status` is red when 3 corrections were kept or when the corrector says a mistake changes the meaning
  (negation, wrong person...), as in the spec.
- The report also returns `levels` (traffic-light color per metric) and `redo_index` (line to redo: the red answer,
  else the orange answer with the most corrections). They are not in `openapi.yaml` yet.

## Configuration and privacy

LLM keys and tuning variables are listed in `packages/agent/README.md`; they are read from the API's environment
(`apps/api/.env`). Only text is kept, never audio. With Langfuse enabled, traces contain the student's text (no
name, no email): keep that project private.
