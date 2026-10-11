import pytest
from fastapi.testclient import TestClient
from tkallem_agent import list_scenarios
from tkallem_agent.scenarios import load_scenario

from app.main import app
from app.security import ClerkClaims, get_clerk_claims


@pytest.fixture
def client():
    app.dependency_overrides[get_clerk_claims] = lambda: ClerkClaims(user_id="user_scenarios_test", session_id=None)
    yield TestClient(app)
    app.dependency_overrides.clear()


def by_id(client) -> dict[str, dict]:
    return {s["id"]: s for s in client.get("/scenarios").json()}


def test_lists_every_scenario_of_the_agent(client):
    response = client.get("/scenarios")

    assert response.status_code == 200
    assert [s["id"] for s in response.json()] == [s.id for s in list_scenarios()]


def test_guided_scenario_has_its_questions_count(client):
    visa = load_scenario("visa-us")

    assert by_id(client)["visa-us"] == {
        "id": "visa-us",
        "title": visa.title,
        "mode": "guided",
        "minutes": visa.minutes,
        "total_questions": len(visa.questions),
        "description": None,
        "category": None,
        "level": None,
        "icon": None,
    }


def test_free_talk_has_no_questions_count(client):
    free = by_id(client)["free-talk"]

    assert free["mode"] == "free"
    assert free["total_questions"] is None
    assert free["minutes"] == load_scenario("free-talk").minutes


def test_scenarios_require_a_token():
    assert TestClient(app).get("/scenarios").status_code == 401
