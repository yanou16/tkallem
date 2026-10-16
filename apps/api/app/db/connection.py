from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from app.config import settings

from collections.abc import Callable
from contextlib import AbstractContextManager

from psycopg import Connection

pool = ConnectionPool(
    conninfo=settings.database_url,
    min_size=settings.db_pool_min,
    max_size=settings.db_pool_max,
    timeout=settings.db_pool_timeout,  # then PoolTimeout: fail fast rather than keep a student waiting
    open=False,
    check=ConnectionPool.check_connection,
    kwargs={"row_factory": dict_row},
)


def open_pool() -> None:
    pool.open(wait=True, timeout=10)


def close_pool() -> None:
    pool.close()


def get_conn():
    with pool.connection() as conn:
        yield conn

ConnFactory = Callable[[], AbstractContextManager[Connection]]

def get_conn_factory() -> ConnFactory:
    return pool.connection
