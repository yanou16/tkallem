# Tests and the road to main

Nothing reaches `main` without passing every check below: `main` only accepts pull requests whose **CI ok** job is
green (`.github/workflows/ci.yml`). After a merge, the API image is built, deployed to Azure and smoke-tested
(`.github/workflows/api-image.yml`); Vercel deploys the front, and builds a preview for every pull request.

## What runs where

| Check | When | Command (locally) |
|---|---|---|
| Agent tests | every PR | `cd packages/agent && ../../apps/api/.venv/bin/pytest -q` |
| API tests, **with a real Postgres** | every PR | `cd apps/api && TEST_DATABASE_URL=<scratch database> .venv/bin/pytest -q` |
| Front typecheck, unit tests, production build | every PR | `cd apps/web && npm run typecheck && npm test && npm run build` |
| API Docker image builds | every PR | `docker build -f apps/api/Dockerfile .` |
| AI evals gate (29/29 errors detected, 0 false alarm, 9/9 attacks, Help me start: 0 complete-answer starter, 0 changed name or number) | PRs that change `packages/agent` | `cd packages/agent && ../../apps/api/.venv/bin/python evals/gate.py` |
| Smoke test of the deployed API (`/health` reports the new commit, `/scenarios` answers) | after each deploy | `curl https://tkallem-api-rayane.azurewebsites.net/health` |
| Quick checks before a push (agent, API without database, front) | `git push` | `git config core.hooksPath .githooks` once |

## Features and their tests

| Feature | Tests |
|---|---|
| Corrections: at most 3, no invented or no-op fix, names and numbers kept, colour from the fixes | `packages/agent/tests/test_schemas.py`, `test_graph.py`; eval `evals/run_evals.py` (33 sentences) |
| Coach reply: one sentence at the level, next question verbatim, prompt injection | `test_graph.py`, `test_session.py`; eval `evals/injection.py` |
| Question order: repeat an unanswered question once, skip answered ones, two goals in one answer, skippable questions | `test_session.py`, `test_graph.py`; eval `evals/goals.py` |
| Backup language models | `test_session.py` |
| Session report: metrics, colours, answer to redo, honest note | `test_report.py`, API `test_turn_routes.py` |
| Scenarios: files valid, cards, public list | `test_scenarios.py`, API `test_scenarios_routes.py` |
| Answering (typed and spoken), saving a turn, reloading a session | API `test_turn_routes.py`, `test_sessions_db.py`, `test_sessions_routes.py` |
| Streaming answer (transcript, reply, corrections, audio, done or error) | API `test_voice_routes.py`; front `features/ai-chat/api/ai.test.ts` |
| Voice: transcription, coach voice, WAV repair, invented or silent transcripts refused | API `test_voice.py`, `test_voice_routes.py` |
| Voice providers backing each other up, retry on connection failure | API `test_voice_failover.py` |
| Recording too short or silent, which voice speaks the coach | front `features/ai-chat/lib/voice.test.ts` |
| Correction shown under the answer (wrong and fixed words) | front `features/ai-chat/lib/marks.test.ts` |
| Help me start: starters stop before the content (12 words max, no invented name or number), translations keep names and numbers and are finished sentences, fallback to the scenario's starter, current question | `test_hints.py` (and every scenario starter in it); eval `evals/hints.py` (10 starters, 10 French and Darija ideas) |
| Credits: grants, daily refill, atomic debit (10 concurrent answers), refunds, budget cap and alert | API `test_credits.py` |
| Guest mode: token, address limits, claim at sign-in, unknown guest refused | API `test_credits_routes.py`; front `features/credits/lib/guestStep.test.ts` |
| Sign-in: Clerk tokens, allowed origins | API `test_security.py`; front `features/auth/lib/username.test.ts` |
| Profile, learning setup, progress, top mistakes, achievements | API `test_me_routes.py`, `test_progress_db.py`, `test_achievements_db.py`, `test_users.py`; front `features/profile`, `features/progress` |
| API client: tokens, guest token, error messages | front `lib/api/client.test.ts` |
| Installing the app (PWA): which help each phone gets, when the banner shows | front `lib/install.test.ts` |
| Health and deployed version | API `test_health.py` |
| Eval gate: a provider outage (5xx, 429, timeout) is tried again, up to 3 times; a wrong answer never is | `test_eval_outage.py` |

## Not covered by automatic tests (checked by hand before a release)

- Real microphones and speakers on Android Chrome and iPhone Safari (autoplay rules, microphone permission).
- The Google sign-in round trip (needs a real Google account).
- The 3D coach rendering (needs WebGL).
- Language model quality beyond the eval sets: the review sheets in `packages/agent/evals/review/` are read by people.
