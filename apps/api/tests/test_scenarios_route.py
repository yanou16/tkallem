from fastapi.testclient import TestClient

from app.main import app


def test_scenario_cards_are_public_and_filterable():
    c = TestClient(app)
    everything = c.get("/scenarios")
    assert everything.status_code == 200
    ids = {s["id"] for s in everything.json()}
    assert {"visa-us", "visa-business"} <= ids
    card = next(s for s in everything.json() if s["id"] == "visa-us")
    assert card["description"] and card["duration"] and card["icon"]
    travel = c.get("/scenarios", params={"category": "travel"}).json()
    assert travel and all(s["category"] == "travel" for s in travel)
