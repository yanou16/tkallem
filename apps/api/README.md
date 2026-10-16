# Tkallem API

The backend of Tkallem: practice sessions with the AI coach, the student's profile and progress, credits and guest mode,
and the practice groups (REST plus a WebSocket). Back to the project: [`README.md`](../../README.md).

## Stack

- **FastAPI** with Pydantic v2 and pydantic-settings. Routes are plain `def` (FastAPI runs them in a thread pool);
  only the WebSocket and the group routes that broadcast an event are `async def`.
- **PostgreSQL on Neon**, through **psycopg 3** with **raw SQL** (`dict_row`), no ORM. One connection pool
  (`psycopg_pool`, 1 to 5 connections) opened at startup.
- **Alembic** for migrations, written as SQL (`op.execute`).
- **Clerk** for sign-in: the API checks the Clerk session JWT (RS256, keys from the Clerk JWKS, issuer checked, `azp`
  checked against `FRONTEND_ORIGIN`). Visitors without an account send a signed guest token instead
  (`Authorization: Guest <token>`, see `app/guests.py`).
- **The coach** is the `packages/agent` package (LangGraph), installed in editable mode by `requirements.txt`.
- **Voice**: speech to text and text to speech through Groq and DeepInfra, each with a backup.
- **pytest**, with a real Postgres database.

## Structure

```
apps/api/
├── app/
│   ├── main.py            FastAPI app: CORS, routers, GET /health, opens the database pool at startup
│   ├── config.py          settings, read from the environment and from .env (pydantic-settings)
│   ├── security.py        Clerk JWT check, and the guest token header
│   ├── dependencies.py    the current user (a signed-in student is created on the first call)
│   ├── guests.py          signed guest tokens (HMAC with GUEST_SECRET)
│   ├── credits.py         credit wallet and ledger, daily refill, daily spending cap and its alert
│   ├── progress_line.py   the first line of the report (progress since the last session), written by code
│   ├── rate_limit.py      per-student limits of the groups, in memory (20 messages a minute, 30 checks per 24 h)
│   ├── realtime.py        ConnectionManager: open group WebSockets, kept in memory
│   ├── routes/            one router per domain: sessions, me, credits, scenarios, groups, group_ws (WebSocket)
│   ├── db/                the SQL, one module per domain: connection (pool), users, sessions, progress,
│   │                      achievements, groups
│   ├── schemas/           Pydantic request and response models, one module per domain
│   ├── voice/             speech to text, text to speech, provider backup chain, the voice turn pipeline
│   └── data/              group_themes.json: the themes of the week of the groups (8 themes x 7 questions)
├── alembic/versions/      migrations
├── tests/                 pytest (conftest.py has the `db` fixture)
├── scripts/               impact.py (confidence summary for the pitch), voice_bench.py (compares voice providers)
├── Dockerfile             the image (built from the repository root, it installs packages/agent)
└── start.sh               container start: migrations, then one uvicorn process
```

## Run it locally

Python 3.12. Run every command from `apps/api`: the settings and the agent read `.env` from the working directory.

```bash
cd apps/api
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt       # also installs packages/agent (editable)
cp .env.example .env                            # fill in the values; .env is ignored by Git
.venv/bin/alembic upgrade head                  # migrates the database in DATABASE_URL
.venv/bin/uvicorn app.main:app --reload --port 8000
```

On Windows, use `.venv\Scripts\pip.exe`, `.venv\Scripts\alembic.exe` and `.venv\Scripts\uvicorn.exe`.

Then open http://localhost:8000/health and the interactive docs at http://localhost:8000/docs.

## Environment variables

Names and roles only: the values go in `apps/api/.env` locally (see `.env.example`) and in the App Service settings in
production (see `infra/azure/api.env.example`). Never commit a value.

| Variable | Role |
|---|---|
| `DATABASE_URL` | Postgres database of the API (Neon) |
| `TEST_DATABASE_URL` | Database used by the tests, never the same as `DATABASE_URL` |
| `CLERK_JWKS_URL`, `CLERK_ISSUER` | Where the Clerk signing keys are, and the expected token issuer. Without them, authentication answers 503 |
| `FRONTEND_ORIGIN` | Allowed web origins, comma separated: CORS, the WebSocket origin check and the token `azp` check |
| `LLM_PROVIDER`, `LLM_MODEL` | Main language model of the coach (`openrouter` or `groq`) |
| `LLM_FALLBACKS` | Backup models, comma separated `provider:model` |
| `OPENROUTER_API_KEY`, `GROQ_API_KEY`, `DEEPINFRA_API_KEY` | Provider keys (Groq: model backups and voice; DeepInfra: voice backup) |
| `STT_PROVIDER`, `TTS_PROVIDER`, `STT_MODEL` | Voice providers in backup order (`groq,deepinfra`), and the transcription model |
| `VOICE_TIMEOUT`, `VOICE_CONNECT_TIMEOUT` | Time limits of a voice provider call |
| `MAX_AUDIO_BYTES`, `MAX_TEXT_CHARS` | Largest recording and longest typed answer accepted |
| `GUEST_SECRET` | Signs guest tokens (32 characters or more). Empty: guest mode is off |
| `GUEST_CREDITS`, `LOGIN_BONUS`, `DAILY_REFILL`, `REFILL_CAP` | Credits: for a guest, once at sign-up, every day, and the refill ceiling (see `docs/CREDITS.md`) |
| `GUEST_IP_DAILY_CAP`, `GUEST_DAILY_CAP` | Guest accounts per network address per day, and for everyone per day |
| `FORWARDED_HOPS` | Reverse proxies in front of the API, to read the visitor's address (0: the socket address) |
| `DAILY_SPEND_CAP`, `BUDGET_ALERT_RATIO`, `ALERT_WEBHOOK_URL` | Credits everyone may spend per day, when to warn, and where (Slack or Discord webhook; empty: logs only) |
| `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_HOST` | Tracing of the agent calls, off unless both keys are set (the host is read by the Langfuse client) |
| `RUN_MIGRATIONS`, `PORT`, `TKALLEM_VERSION` | Container only: `0` skips the migrations at start, the listening port (8000), the commit shown by `/health` |

Optional agent tuning, read by `packages/agent` (defaults in `tkallem_agent/llm.py`, `graph.py`, `session.py` and
`scenarios.py`): `LLM_TIMEOUT`, `LLM_PRIMARY_TIMEOUT`, `LLM_MAX_RETRIES`, `LLM_TEMPERATURE`, `OPENROUTER_PROVIDER_SORT`,
`TKALLEM_HEDGE_AFTER`, `TKALLEM_LLM_WORKERS`, `TKALLEM_STRUCTURED_METHOD`, `TKALLEM_MAX_TEXT_CHARS`,
`TKALLEM_SCENARIOS_DIR`.

## Migrations

```bash
.venv/bin/alembic upgrade head      # applies every migration to DATABASE_URL
.venv/bin/alembic current           # where a database is
.venv/bin/alembic heads             # must print exactly one line
```

- The container runs `alembic upgrade head` at start (`start.sh`), unless `RUN_MIGRATIONS=0`.
- A migration is SQL in `op.execute`, and its `downgrade()` is the exact inverse. Constraints (`CHECK`, `UNIQUE`) live
  in the database.
- **Never change a migration that is already applied to a shared database** (production, dev, a teammate's): write a
  new one.
- **One head only.** After merging `main`, if `alembic heads` prints two lines, point the `down_revision` of your own
  migration, the one not applied to any shared database yet, at the head that came from `main`.
- Try a new migration on your test database first: `upgrade head`, `downgrade -1`, `upgrade head`.

## Tests

The tests need a database of their own: set `TEST_DATABASE_URL` to a personal Neon branch (or a local Postgres), never
to the dev database. The `db` fixture refuses to run when it equals `DATABASE_URL`, and the database tests are skipped
when it is empty.

```bash
DATABASE_URL="$TEST_DATABASE_URL" .venv/bin/alembic upgrade head   # once, then after every new migration
.venv/bin/pytest -q
```

- Each test using the `db` fixture runs in a transaction that is rolled back. The few concurrency tests commit their
  own rows and delete them at the end.
- The language model is replaced by `tkallem_agent.testing.FakeChat`, so the tests need no model key.
- In CI (`.github/workflows/ci.yml`), a Postgres 16 service gets the same migrations, then `pytest -q`.

## Routes

The full schema is at `/docs` while the API runs. "Student" means a signed-in account; "guest" a visitor without an
account.

| Method | Path | Who | Role |
|---|---|---|---|
| GET | `/health` | anyone | Status and deployed version |
| GET | `/scenarios` | anyone | The practice scenarios |
| POST | `/guests` | anyone | A guest token and the guest credits (limited per address and per day) |
| GET | `/me/credits` | student or guest | Credit balance |
| POST | `/me/claim-guest` | student | After sign-in: brings the guest's sessions and remaining credits to the account |
| GET, PATCH | `/me` | student or guest | The learning setup: level, explanation language, first name, daily goal… |
| GET | `/me/sessions` | student or guest | Recent sessions |
| GET | `/me/progress` | student or guest | Metrics, top mistakes, practice time, streak |
| GET | `/me/achievements` | student or guest | Badges |
| POST | `/sessions` | student or guest | Starts a session (scenario, text or voice, practice or real interview); 409 without a level |
| GET | `/sessions/{id}` | student or guest | Reloads a session with its turns |
| POST | `/sessions/{id}/turn` | student or guest | One answer, typed or spoken: 1 credit. JSON, or Server-Sent Events with `Accept: text/event-stream` |
| POST | `/sessions/{id}/end` | student or guest | Ends the session and returns the report |
| POST | `/sessions/{id}/speak` | student or guest | The coach says its last line again (switching to voice) |
| POST | `/sessions/{id}/hint` | student or guest | "Help me start": free, 2 per question |
| POST | `/sessions/{id}/repeat` | student or guest | "Say it again", judged by code |
| POST | `/sessions/{id}/confidence` | student or guest | Confidence from 1 to 5, before or after |
| GET | `/groups/recommended` | student | Groups of the student's level with room left, most active first |
| POST | `/groups/join` | student | Joins the best group of the student's level, or a new one created by the API |
| POST | `/groups/{id}/join` | student | Joins one group: 409 when already in a group or the group is full, 403 for another level |
| GET | `/me/group` | student | The student's group, or `null` |
| GET | `/groups/{id}` | member | Members, theme of the week and question of the day |
| GET | `/groups/{id}/messages` | member | Messages, oldest first: `before_id` for older pages, `after_id` to catch up after a reconnection |
| POST | `/groups/{id}/messages` | member | Sends a message (1 to 500 characters), then broadcasts it on the WebSocket |
| DELETE | `/groups/{id}/members/me` | member | Leaves the group |
| POST | `/groups/{id}/messages/{message_id}/report` | member | Reports another member's message, once; hidden for everyone at 3 reports |
| POST | `/groups/{id}/check` | member | Private correction of a draft: nothing is posted or stored |
| GET | `/groups/{id}/leaderboard` | member | Members ranked by practice time over the last 7 days, then by streak |
| WebSocket | `/ws/groups/{id}` | member | Live events of the group (below) |

## Practice groups

Written English between students of the same level: 8 members at most, one group at a time, groups created by the
API. Guests get 403, and a student without a level gets 409. Limits: 20 messages per minute and 30 private checks per
24 hours per student (429).

### WebSocket `/ws/groups/{id}`

It only receives: sending always goes through `POST /groups/{id}/messages`.

1. The client opens `ws://` (`wss://` in production) on the API host. The server accepts, then checks the `Origin`
   header against `FRONTEND_ORIGIN`.
2. Within 5 seconds, the client's first message must be `{"type": "auth", "token": "<Clerk session token>"}`. A token
   never goes in the URL, and guest tokens are refused.
3. The server answers `{"type": "auth.ok"}`, then sends the group events.
4. The client sends `{"type": "ping"}` every 25 seconds and gets `{"type": "pong"}`. Any other client message is
   ignored.

| Event (server to client) | Content |
|---|---|
| `message.created` | `message`: the same shape as in `GET /groups/{id}/messages` |
| `message.hidden` | `message_id`: reported 3 times, remove it |
| `member.joined` | `member`: `id`, `first_name` |
| `member.left` | `member`: `id`, `first_name` |

| Close code | Meaning | Reconnect? |
|---|---|---|
| 1008 | Origin not allowed | no |
| 4401 | Token missing, invalid or sent too late | no |
| 4403 | Not, or no longer, a member (leaving the group closes the student's connections with it) | no |
| 4404 | No such group | no |
| 1011 | Authentication unavailable (Clerk not configured or unreachable) | yes, later |

After a reconnection, the web app catches up with `GET /groups/{id}/messages?after_id=<last id shown>`.

### Hidden in the web app

The screen exists in `apps/web` but is hidden unless the web app is built with `NEXT_PUBLIC_FEATURE_GROUPS=1`
(`apps/web/src/lib/features.ts`): without it, there is no menu link and `/groups` redirects to `/practice`
(`docs/JURY_BRIEF.md` F-4). The API routes above stay active either way.

### One uvicorn process until Redis

Run **one** process: `uvicorn` without `--workers`, as `start.sh` does, and one server instance (the Azure plan
setting: to be confirmed). Several things live in the memory of that process:

- the open group WebSockets (`app/realtime.py`, `# TODO: Redis pub/sub`);
- the group limits (`app/rate_limit.py`, `# TODO: Redis`);
- the hint, "Say it again" and voice replay limits (`app/routes/sessions.py`);
- the resting voice providers (`app/voice/failover.py`).

With two processes, a message posted on one would not reach the WebSockets open on the other, and each process would
count its own limits.
