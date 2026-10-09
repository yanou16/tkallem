import logging
from collections.abc import Generator

from psycopg import Connection
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from app.config import settings

logger = logging.getLogger(__name__)

pool = ConnectionPool(
    conninfo=settings.database_url,
    min_size=1,
    max_size=5,
    open=False,
    check=ConnectionPool.check_connection,
    kwargs={"row_factory": dict_row},
)


def open_pool() -> None:
    logger.info("Opening PostgreSQL pool")
    pool.open(wait=True, timeout=10)
    logger.info("PostgreSQL pool opened")


def close_pool() -> None:
    logger.info("Closing PostgreSQL pool")
    pool.close()
    logger.info("PostgreSQL pool closed")


def get_conn() -> Generator[Connection | None, None, None]:
    if not settings.database_url:
        yield None
        return
    logger.debug("Waiting for a database connection from the pool")
    try:
        with pool.connection() as conn:
            logger.debug("Database connection acquired")
            yield conn
    except Exception:
        logger.exception("Could not acquire or use a database connection")
        raise
    finally:
        logger.debug("Database connection dependency finished")