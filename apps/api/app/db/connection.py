from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from app.config import settings

pool = ConnectionPool(
    conninfo=settings.database_url,
    min_size=1,
    max_size=5,
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