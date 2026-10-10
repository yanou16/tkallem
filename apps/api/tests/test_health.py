import logging

from fastapi.testclient import TestClient

from app.config import settings
from app.main import app


def test_health():
    r = TestClient(app).get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_startup_without_database_logs_a_warning(monkeypatch, caplog):
    monkeypatch.setattr(settings, "database_url", "")

    with caplog.at_level(logging.WARNING), TestClient(app):
        pass

    warnings = [r for r in caplog.records if "DATABASE_URL is not set" in r.getMessage()]
    assert [r.name for r in warnings] == ["app.main"]
