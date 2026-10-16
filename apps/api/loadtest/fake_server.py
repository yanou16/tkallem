"""Load-test server: the real FastAPI app (app.main) with a fake language model and no voice, so a load test costs
nothing. Run it from apps/api (see loadtest/README.md):

    LOADTEST_DB_HOST=<host printed at the first run> .venv/Scripts/python.exe loadtest/fake_server.py

What changes, for this process only (no file of the app is modified):
- `get_llm` (app/routes/sessions.py) returns an EndlessFakeChat: it always answers (corrections, coach reply, report
  note) after FAKE_LLM_DELAY seconds (default 1.5, about a real model's time);
- the limits made for real visitors are raised, because every virtual user comes from 127.0.0.1: guest accounts per
  address and per day, the daily spending cap; the budget alert webhook and Langfuse tracing are switched off;
- one uvicorn process, like start.sh.

The database is DATABASE_URL from apps/api/.env. Only its host name is printed. The server refuses to start when the
URL is empty, when its host or database name contains "prod", or when LOADTEST_DB_HOST does not repeat that host (a
deliberate confirmation that it is your own database).

Every LOADTEST_STATS_EVERY seconds (default 5) a line goes to LOADTEST_STATS (default loadtest/results/server_stats.csv):
connection pool, worker threads, event loop lag and CPU, to see what saturates first.
"""
import asyncio
import csv
import os
import re
import secrets
import statistics
import sys
import threading
import time
from contextlib import asynccontextmanager
from pathlib import Path
from types import SimpleNamespace
from urllib.parse import urlsplit

HERE = Path(__file__).resolve().parent
sys.path[:0] = [str(HERE.parent), str(HERE)]  # apps/api (the app) and loadtest/ (journey.py)

# Before anything reads the settings: environment variables win over apps/api/.env (pydantic-settings), and the agent
# never overrides a variable already set (load_dotenv(override=False)), so these stay for this process only.
RAISED_FOR_THE_TEST = {
    "GUEST_IP_DAILY_CAP": "1000000",  # every virtual judge has the same address (127.0.0.1)
    "GUEST_DAILY_CAP": "1000000",
    "DAILY_SPEND_CAP": "1000000000",  # the fake model costs nothing
    "ALERT_WEBHOOK_URL": "",  # no Slack or Discord message during a test
    "LANGFUSE_PUBLIC_KEY": "",  # no traces of fake calls
    "LANGFUSE_SECRET_KEY": "",
}
os.environ.update(RAISED_FOR_THE_TEST)

import anyio  # noqa: E402
import psycopg  # noqa: E402
import uvicorn  # noqa: E402
from tkallem_agent.testing import FakeChat  # noqa: E402

from app.config import settings  # noqa: E402
from journey import ANSWERS, REPORT_NOTE  # noqa: E402

FAKE_LLM_DELAY = float(os.environ.get("FAKE_LLM_DELAY", "1.5"))
PORT = int(os.environ.get("LOADTEST_PORT", "8001"))
STATS_PATH = Path(os.environ.get("LOADTEST_STATS", HERE / "results" / "server_stats.csv"))
STATS_EVERY = float(os.environ.get("LOADTEST_STATS_EVERY", "5"))


def check_database() -> str:
    """The host of DATABASE_URL, after the safety checks (never the user name or the password)."""
    url = settings.database_url
    if not url:
        sys.exit("DATABASE_URL is empty: set it in apps/api/.env to your own dev database (a Neon branch).")
    parts = urlsplit(url)
    host = parts.hostname or ""
    database = parts.path.lstrip("/")
    print(f"Database host: {host or '(none)'}   database: {database or '(default)'}")
    if not host:
        sys.exit("DATABASE_URL has no host: refused.")
    if re.search(r"prod", f"{host} {database}", re.IGNORECASE):
        sys.exit("This looks like a production database: refused. A load test only runs on your own dev branch.")
    if os.environ.get("LOADTEST_DB_HOST") != host:
        sys.exit("Confirm it is your own dev database: run again with LOADTEST_DB_HOST=<the host above>.")
    return host


class EndlessFakeChat(FakeChat):
    """FakeChat that never runs out: every call waits `delay` seconds, then answers like a model would.

    - corrector ("Found"): the correction of journey.py whose words are in the answer (none otherwise);
    - coach ("Reply"): a short neutral reaction and the goal of the question the answer belongs to;
    - plain call: the report note.
    The agent's own code still runs on these answers: graph, guardrails (sanitize), storage, report."""

    def with_structured_output(self, schema, **kwargs):
        title = schema["title"] if isinstance(schema, dict) else schema.__name__
        parent = self

        class Bound:
            def invoke(self, messages, config=None):
                time.sleep(parent.delay)
                with parent.lock:
                    parent.calls[title] += 1
                return parent.answer(title, messages)

        return Bound()

    def invoke(self, prompt, config=None):
        time.sleep(self.delay)
        with self.lock:
            self.calls["text"] += 1
        return SimpleNamespace(content=REPORT_NOTE)

    @staticmethod
    def answer(title: str, messages) -> dict:
        last = str(getattr(messages[-1], "content", messages[-1])) if messages else ""
        if title == "Found":
            corrections = [dict(fix) for _, fix, _ in ANSWERS if fix["original"] in last]
            return {"corrections": corrections, "changes_meaning": False, "praise": None, "priority_index": 0}
        if title == "Reply":
            goal = next((goal for text, _, goal in ANSWERS if text in last), None)
            return {"reaction": "Thank you, that is clear.", "goal_covered": goal}
        if title == "Starters":
            return {"starters": ["I would like to"]}
        return {"english": "I would like to study in the US."}


def database_round_trip_ms(pool) -> float:
    """Median time of `SELECT 1` on an open connection: the network delay every query pays."""
    times = []
    with pool.connection() as conn:
        for _ in range(5):
            t0 = time.perf_counter()
            conn.execute("SELECT 1").fetchone()
            times.append((time.perf_counter() - t0) * 1000)
    return statistics.median(times)


NEON_CONNECTIONS = """
    SELECT count(*) AS total, count(*) FILTER (WHERE state = 'active') AS active
    FROM pg_stat_activity
    WHERE backend_type = 'client backend'
"""


def neon_connections(conn) -> tuple[int | None, int | None]:
    """Connections open on the database server itself (all clients, the pooler's included), and how many are working."""
    try:
        row = conn.execute(NEON_CONNECTIONS).fetchone()
        return row[0], row[1]
    except Exception:
        return None, None


async def monitor(pool, fake: EndlessFakeChat) -> None:
    """One CSV line every STATS_EVERY seconds: what is busy, what is waiting."""
    STATS_PATH.parent.mkdir(parents=True, exist_ok=True)
    limiter = anyio.to_thread.current_default_thread_limiter()
    # Its own connection, outside the app's pool, so that measuring never takes a connection from a request.
    server_side = await asyncio.to_thread(psycopg.connect, settings.database_url, autocommit=True)
    columns = ["time", "loop_lag_ms", "cpu_percent", "threads_busy", "threads_max", "threads_waiting", "os_threads",
               "pool_size", "pool_available", "pool_requests_waiting", "pool_requests", "pool_queued",
               "pool_wait_ms_total", "pool_errors", "fake_llm_calls", "neon_connections", "neon_active"]
    with STATS_PATH.open("w", newline="", encoding="utf-8") as f:
        out = csv.writer(f)
        out.writerow(columns)
        wall, cpu, calls, printed = time.perf_counter(), time.process_time(), 0, 0.0
        while True:
            t0 = time.perf_counter()
            await asyncio.sleep(STATS_EVERY)
            lag = (time.perf_counter() - t0 - STATS_EVERY) * 1000  # how late the event loop woke up
            now_wall, now_cpu = time.perf_counter(), time.process_time()
            cpu_percent = (now_cpu - cpu) / (now_wall - wall) * 100  # above 100: several cores
            wall, cpu = now_wall, now_cpu
            s = pool.pop_stats()  # counters since the previous line, and the current gauges
            total_calls = sum(fake.calls.values())
            neon_total, neon_active = await asyncio.to_thread(neon_connections, server_side)
            row = [time.strftime("%H:%M:%S"), round(lag, 1), round(cpu_percent, 1),
                   limiter.borrowed_tokens, int(limiter.total_tokens), limiter.statistics().tasks_waiting,
                   threading.active_count(), s.get("pool_size", 0), s.get("pool_available", 0),
                   s.get("requests_waiting", 0), s.get("requests_num", 0), s.get("requests_queued", 0),
                   s.get("requests_wait_ms", 0), s.get("requests_errors", 0), total_calls - calls,
                   neon_total, neon_active]
            calls = total_calls
            out.writerow(row)
            f.flush()
            if now_wall - printed >= 30:
                printed = now_wall
                print(f"[{row[0]}] cpu {row[2]}%  threads {row[3]}/{row[4]} (+{row[5]} waiting)  "
                      f"pool {row[7] - row[8]}/{s.get('pool_max', 0)} busy, {row[11]} queued, "
                      f"{row[12]} ms waited, {row[13]} errors  loop lag {row[1]} ms  "
                      f"Neon {neon_total} connections ({neon_active} active)", flush=True)


def main() -> None:
    host = check_database()
    if len(settings.guest_secret) < 32:  # guest mode needs a secret: one for this process only, never written
        settings.guest_secret = secrets.token_urlsafe(48)
        print("GUEST_SECRET: generated for this test (guest tokens only work while this server runs)")

    from app.db.connection import pool
    from app.main import app
    from app.routes.sessions import get_llm

    fake = EndlessFakeChat(delay=FAKE_LLM_DELAY)
    app.dependency_overrides[get_llm] = lambda: fake

    original_lifespan = app.router.lifespan_context

    @asynccontextmanager
    async def lifespan_with_monitor(application):
        async with original_lifespan(application) as state:  # opens the pool, as in production
            rtt = await asyncio.to_thread(database_round_trip_ms, pool)
            print(f"Database round trip: {rtt:.0f} ms (each query pays it; each pool checkout adds one more)")
            task = asyncio.create_task(monitor(pool, fake))
            try:
                yield state
            finally:
                task.cancel()

    app.router.lifespan_context = lifespan_with_monitor
    print(f"Fake model: {FAKE_LLM_DELAY} s per call. Raised for this test: {', '.join(RAISED_FOR_THE_TEST)}")
    print(f"Pool: {pool.min_size} to {pool.max_size} connections, {pool.timeout:.0f} s timeout. Stats: {STATS_PATH}")
    print(f"Load-test API on http://127.0.0.1:{PORT} (one process), database {host}")
    # One process, like start.sh: the in-memory guards (limits, WebSocket connections) must stay in one place.
    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="warning", access_log=False, timeout_keep_alive=75)


if __name__ == "__main__":
    main()
