# Load test (Locust)

How many judges can use the API at the same time, and what gives way first. The test costs nothing: the real FastAPI
app runs with a **fake language model** and **no voice**, so no provider is called.

| File | Role |
|---|---|
| `fake_server.py` | The real app (`app.main`) on port 8001, with `get_llm` replaced by a fake model that always answers after 1.5 s, the visitor limits raised for this process only, and a line of server stats every 5 s |
| `locustfile.py` | A virtual judge, as a guest: `POST /guests` → `GET /scenarios` → `POST /sessions` (visa-us, text) → 5 × `POST /sessions/{id}/turn` (Server-Sent Events read to the end) → `POST /sessions/{id}/end` |
| `journey.py` | The 5 answers, the mistake in each one and the goal it covers: shared by both files |
| `../requirements-loadtest.txt` | Locust, kept out of `requirements.txt` (the API never needs it) |

## What is real, what is fake

- **Real:** routes, authentication (guest tokens), Pydantic validation, the credit wallet, the agent's graph and
  guardrails, every SQL query, the connection pool (`DB_POOL_MIN` to `DB_POOL_MAX`, 1 to 10 by default), one uvicorn
  process (like `start.sh`), the database.
- **Fake:** the model. Every call (corrector, coach, report note) waits `FAKE_LLM_DELAY` seconds, then answers like a
  model would (the correction of the mistake in the answer, a short reply, the goal of the question).
- **Off:** voice (the journey only types), the budget alert webhook, Langfuse tracing.
- **Raised for this process only** (every virtual judge comes from 127.0.0.1): `GUEST_IP_DAILY_CAP`,
  `GUEST_DAILY_CAP`, `DAILY_SPEND_CAP`. No `.env` file is changed. When `GUEST_SECRET` is shorter than 32 characters,
  the server makes one for its own lifetime.

## The database

`fake_server.py` uses `DATABASE_URL` from `apps/api/.env`: **use your own dev branch** (Neon), never production and never
the shared database. It prints the host name only, refuses an empty URL or a host or database name containing `prod`,
and only starts when `LOADTEST_DB_HOST` repeats that host. Every journey creates real rows (one guest, its wallet, one
session, 5 turns and their corrections, the metrics): reset the branch from its parent in Neon afterwards if you want
it clean. The schema must be at the last migration (`alembic current` shows `(head)`).

## Install

```bash
cd apps/api
.venv/Scripts/python.exe -m pip install -r requirements-loadtest.txt
```

## Run (Windows, Git Bash)

Terminal 1, the server (from `apps/api`). The first run prints the database host and stops: run it again with that host.

```bash
.venv/Scripts/python.exe loadtest/fake_server.py
LOADTEST_DB_HOST=<the host printed above> .venv/Scripts/python.exe loadtest/fake_server.py
```

Terminal 2, Locust (from `apps/api/loadtest`), with the web interface on http://localhost:8089:

```bash
../.venv/Scripts/locust.exe -f locustfile.py --host http://127.0.0.1:8001
```

Or headless, one step at a time (here 30 users, 3 started per second, for 2 minutes), with CSV and HTML reports:

```bash
mkdir -p results
../.venv/Scripts/locust.exe -f locustfile.py --headless -u 30 -r 3 -t 2m --host http://127.0.0.1:8001 \
  --csv results/u30 --csv-full-history --html results/u30.html
```

Stop the server (Ctrl+C) and start it again between two steps, so each step has its own `server_stats.csv`
(`LOADTEST_STATS=results/server_stats_u30.csv`).

## Settings

| Variable | Default | Role |
|---|---|---|
| `LOADTEST_DB_HOST` | (none) | Confirms the database host; the server refuses to start without it |
| `FAKE_LLM_DELAY` | `1.5` | Seconds each fake model call takes |
| `LOADTEST_PORT` | `8001` | Port of the fake server |
| `LOADTEST_STATS` | `loadtest/results/server_stats.csv` | Where the server writes its stats |
| `LOADTEST_STATS_EVERY` | `5` | Seconds between two stats lines |
| `LOCUST_THINK_MIN`, `LOCUST_THINK_MAX` | `2`, `5` | Seconds a virtual judge waits before each step (reading, typing) |
| `DB_POOL_MAX` (and `DB_POOL_MIN`, `DB_POOL_TIMEOUT`) | the app's | The app's own pool settings: set one on the fake server to try another pool size |

A virtual judge waits 2 to 5 s between steps; a real one reads and types for much longer (about 20 s per answer), so one
virtual judge sends roughly as many answers as several real ones.

## Reading the results

- **Locust:** one line per step. `4. POST /sessions/[id]/turn (full SSE)` is timed until the last event (`done`);
  `4a. turn: coach reply received` is the time until the coach's text arrives, what the judge waits before reading.
- **`server_stats.csv`:** `pool_*` is the connection pool (`pool_queued`: checkouts that had to wait, `pool_wait_ms_total`:
  how long in total, `pool_errors`: timeouts after 30 s); `threads_busy` / `threads_max` are the worker threads that run
  the `def` routes and the streamed answers; `loop_lag_ms` is how late the event loop is; `cpu_percent` is the process;
  `neon_connections` / `neon_active` count the connections open on the database server itself (`pg_stat_activity`,
  every client of that compute, the pooler's included), measured on a connection of its own outside the app's pool.
- The fake server prints `Database round trip` at start. Run locally, every query pays the trip from your machine to
  Neon (about 50 ms from Algeria); on Azure, next to Neon in Frankfurt, it should be a few milliseconds (not measured
  yet). A local run therefore shows the **order** in which things saturate, not production's absolute numbers.
