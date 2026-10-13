# Impact numbers

What Tkallem can measure about the problem it targets (students who freeze), from real sessions. Only averages, never a
student.

| Number | Where it comes from | How to read it |
|---|---|---|
| **Confidence before and after** (1 to 5) | The student's own answers: before the first answer, and on the report. Skippable. | `cd apps/api && PYTHONPATH=. .venv/bin/python scripts/impact.py` prints "Average confidence: 2.3 before, 3.8 after, over N sessions." Only sessions with both answers count. Use the production `DATABASE_URL`. |
| **Time before you start** (freeze meter) | The app measures the seconds between the end of the coach's question and the first sound or letter; the server averages them per session. | In the report ("Down from 9 s last time"). Voice and typed sessions are never compared with each other. |
| **Mistakes per 100 words, answer length, pauses** | Computed by code from the transcripts. | In the report and on the Progress screen. |

Honest limits for the submission: confidence is self-reported, N is small, and there is no control group. Say it that way.
