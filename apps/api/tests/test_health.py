import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app


def test_health():
    r = TestClient(app).get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_scenario_files_have_required_keys():
    for f in Path("app/scenarios").glob("*.json"):
        data = json.loads(f.read_text())
        assert {"id", "title", "coach_role", "questions", "goals", "useful_words"} <= data.keys()
