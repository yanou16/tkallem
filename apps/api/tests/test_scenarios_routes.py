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

    card = by_id(client)["visa-us"]

    assert card["mode"] == "guided"
    assert card["title"] == visa.title
    assert card["minutes"] == visa.minutes
    assert card["total_questions"] == len(visa.questions)


def test_free_talk_has_no_questions_count(client):
    free = by_id(client)["free-talk"]

    assert free["mode"] == "free"
    assert free["total_questions"] is None
    assert free["minutes"] == load_scenario("free-talk").minutes


def test_scenarios_are_public():
    # The welcome page lists them before any account or guest exists (no student data in them).
    response = TestClient(app).get("/scenarios")
    assert response.status_code == 200
    ids = {s["id"] for s in response.json()}
    assert {"visa-us", "university-admission", "renting-a-room"} <= ids
    assert not {"campus-france", "visa-business"} & ids  # one visa card, and the admission interview has no visa


def test_scenarios_include_card_fields(client):
    cards = by_id(client)

    for scenario in list_scenarios():
        card = cards[scenario.id]
        assert card["description"] == scenario.description
        assert card["category"] == scenario.category
        assert card["level"] == scenario.level
        assert card["icon"] == scenario.icon
