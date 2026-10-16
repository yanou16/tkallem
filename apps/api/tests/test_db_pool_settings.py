import pytest
from pydantic import ValidationError

from app.config import Settings, settings
from app.db.connection import pool

POOL_VARIABLES = ("DB_POOL_MIN", "DB_POOL_MAX", "DB_POOL_TIMEOUT")


@pytest.fixture
def no_pool_variables(monkeypatch):
    for name in POOL_VARIABLES:
        monkeypatch.delenv(name, raising=False)


def test_pool_defaults(no_pool_variables):
    defaults = Settings(_env_file=None)  # what the code gives, whatever apps/api/.env says

    assert (defaults.db_pool_min, defaults.db_pool_max, defaults.db_pool_timeout) == (1, 10, 10.0)


def test_pool_settings_come_from_the_environment(no_pool_variables, monkeypatch):
    monkeypatch.setenv("DB_POOL_MIN", "2")
    monkeypatch.setenv("DB_POOL_MAX", "15")
    monkeypatch.setenv("DB_POOL_TIMEOUT", "5.5")

    configured = Settings(_env_file=None)

    assert (configured.db_pool_min, configured.db_pool_max, configured.db_pool_timeout) == (2, 15, 5.5)


@pytest.mark.parametrize("name, value", [("DB_POOL_MAX", "0"), ("DB_POOL_MIN", "-1"), ("DB_POOL_TIMEOUT", "0")])
def test_impossible_pool_settings_are_refused(no_pool_variables, monkeypatch, name, value):
    monkeypatch.setenv(name, value)

    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_the_pool_uses_the_settings():
    assert (pool.min_size, pool.max_size, pool.timeout) == (settings.db_pool_min, settings.db_pool_max, settings.db_pool_timeout)
