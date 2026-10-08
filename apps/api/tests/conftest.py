import psycopg
import pytest
from psycopg.rows import dict_row

from app.config import settings


@pytest.fixture
def db():
    if not settings.test_database_url:
        pytest.skip("TEST_DATABASE_URL is not set")
    if settings.test_database_url == settings.database_url:
        pytest.fail("TEST_DATABASE_URL must point to a different database than DATABASE_URL")

    with psycopg.connect(settings.test_database_url, row_factory=dict_row) as conn:
        yield conn
        conn.rollback()