import logging
import time
from contextlib import contextmanager, nullcontext

import psycopg
import pytest
from fastapi.testclient import TestClient
from psycopg_pool import ConnectionPool, PoolTimeout

from app import main
from app.config import settings
from app.db.connection import get_conn_factory
from app.main import app

SECRET_DETAILS = ("ep-secret-host", "hunter2", "Traceback", "OperationalError", "PoolTimeout")


@pytest.fixture
def ready_with():
    """Calls GET /ready with a given connection factory in place of the pool (the real pool is never opened here)."""
    def call(factory):
        app.dependency_overrides[get_conn_factory] = lambda: factory
        return TestClient(app).get("/ready")

    yield call
    app.dependency_overrides.clear()


def test_ready_when_the_database_answers(db, ready_with):
    asked = {}

    def factory(timeout=None):
        asked["timeout"] = timeout
        return nullcontext(db)  # the test database, rolled back at the end

    r = ready_with(factory)

    assert r.status_code == 200
    assert r.json() == {"status": "ready"}
    assert r.headers["cache-control"] == "no-store"
    assert asked["timeout"] == main.READY_TIMEOUT_S  # 2 s to get a connection, not the pool's 10 s


def test_not_ready_when_the_pool_gives_no_connection(ready_with):
    def factory(timeout=None):
        raise PoolTimeout(f"couldn't get a connection after {timeout:.2f} sec")

    r = ready_with(factory)

    assert r.status_code == 503
    assert r.json() == {"status": "not_ready"}
    assert r.headers["cache-control"] == "no-store"


class BrokenConnection:
    def execute(self, *args, **kwargs):
        raise psycopg.OperationalError('connection to server at "ep-secret-host" failed: password "hunter2" refused')


def test_not_ready_when_the_query_fails_and_nothing_leaks(ready_with, caplog):
    with caplog.at_level(logging.ERROR):
        r = ready_with(lambda timeout=None: nullcontext(BrokenConnection()))

    assert r.status_code == 503
    assert r.json() == {"status": "not_ready"}
    assert not any(secret in r.text for secret in SECRET_DETAILS)  # no message, host or stack trace in the response
    assert any("Readiness check failed" in rec.getMessage() for rec in caplog.records)  # logged on the server only


def test_not_ready_when_the_database_hangs(ready_with, monkeypatch):
    monkeypatch.setattr(main, "READY_TIMEOUT_S", 0.05)  # overall bound: 2 x 0.05 + 1 s

    class Hanging:
        def execute(self, *args, **kwargs):
            time.sleep(3)  # a network that does not answer

    started = time.perf_counter()
    r = ready_with(lambda timeout=None: nullcontext(Hanging()))

    assert r.status_code == 503
    assert r.json() == {"status": "not_ready"}
    assert time.perf_counter() - started < 2.5  # answered by the overall bound, not after the 3 s hang


def test_ready_through_a_real_pool_on_the_test_database(db, ready_with):
    # The same path as production (pool.connection with a timeout, then the parameterized set_config), on
    # TEST_DATABASE_URL only; the `db` fixture has already checked it is set and is not DATABASE_URL.
    pool = ConnectionPool(conninfo=settings.test_database_url, min_size=1, max_size=1, open=False)
    pool.open(wait=True, timeout=10)
    try:
        r = ready_with(pool.connection)
    finally:
        pool.close()

    assert r.status_code == 200
    assert r.json() == {"status": "ready"}


def test_health_stays_up_when_the_database_is_down(ready_with):
    @contextmanager
    def no_database(timeout=None):
        raise PoolTimeout("couldn't get a connection")
        yield

    assert ready_with(no_database).status_code == 503
    health = TestClient(app).get("/health")
    assert health.status_code == 200  # liveness: the process runs, whatever the database does
    assert health.json()["status"] == "ok"
