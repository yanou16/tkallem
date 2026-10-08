import pytest
from fastapi.testclient import TestClient

from app.db.connection import get_conn
from app.main import app
from app.security import ClerkClaims, get_clerk_claims


@pytest.fixture
def client(db):
    app.dependency_overrides[get_clerk_claims] = lambda: ClerkClaims(
        user_id="user_route_test", session_id=None
    )
    app.dependency_overrides[get_conn] = lambda: db
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_get_me_creates_profile_on_first_visit(client):
    response = client.get("/me")

    assert response.status_code == 200
    assert response.json() == {"first_name": None, "level": None, "explain_lang": "fr"}


def test_patch_me_updates_level(client):
    response = client.patch("/me", json={"level": "B1"})

    assert response.status_code == 200
    assert response.json()["level"] == "B1"
    assert client.get("/me").json()["level"] == "B1"


@pytest.mark.parametrize(
    "body",
    [{}, {"clerk_user_id": "someone_else"}, {"level": "Z9"}, {"level": None}],
    ids=["empty", "forbidden_field", "invalid_level", "null_level"],
)
def test_patch_me_rejects_invalid_body(client, body):
    assert client.patch("/me", json=body).status_code == 422


def test_me_requires_a_token():
    assert TestClient(app).get("/me").status_code == 401