"""Real interview mode (docs/JURY_BRIEF.md, improvement 3): no correction, colour, praise or hint reaches the client
during the session, and the report contains all of them. No network: the model is a FakeChat."""
import json
from contextlib import nullcontext

import pytest
from fastapi.testclient import TestClient

from app.db.connection import get_conn, get_conn_factory
from app.db.users import get_or_create_by_clerk_id, update_profile
from app.main import app
from app.routes.sessions import get_llm
from app.security import ClerkClaims, get_clerk_claims
from tkallem_agent.testing import FakeChat

CLERK_ID = "user_interview_test"
FIX = {"original": "for study", "fixed": "to study", "type": "grammar", "why": "Le but : to + verbe."}
FOUND = {"corrections": [FIX], "praise": "Clear goal: you go to the US."}
TEXT = "I go to the US for study."


@pytest.fixture
def client(db):
    app.dependency_overrides[get_clerk_claims] = lambda: ClerkClaims(user_id=CLERK_ID, session_id=None)
    app.dependency_overrides[get_conn] = lambda: db
    app.dependency_overrides[get_conn_factory] = lambda: (lambda: nullcontext(db))
    user = get_or_create_by_clerk_id(db, CLERK_ID)
    update_profile(db, user["id"], {"level": "B1"})
    yield TestClient(app)
    app.dependency_overrides.clear()


def start(client, mode, found=FOUND, n=1):
    app.dependency_overrides[get_llm] = lambda: FakeChat(
        [found] * n, [{"reaction": "I see.", "goal_covered": "purpose_of_trip"}] * n, text=["Note."])
    body = client.post("/sessions", json={"scenario_id": "visa-us", "mode": "text", "feedback_mode": mode}).json()
    return body["session_id"], body


def sse(response):
    events = {}
    for block in response.text.strip().split("\n\n"):
        lines = dict(line.split(": ", 1) for line in block.splitlines() if ": " in line)
        events[lines["event"]] = json.loads(lines["data"])
    return events


def test_the_mode_is_practice_by_default_and_chosen_at_the_start(client):
    assert start(client, "practice")[1]["feedback_mode"] == "practice"
    app.dependency_overrides[get_llm] = lambda: FakeChat()
    default = client.post("/sessions", json={"scenario_id": "visa-us"}).json()
    assert default["feedback_mode"] == "practice"
    assert client.post("/sessions", json={"scenario_id": "visa-us", "feedback_mode": "exam"}).status_code == 422


def test_nothing_is_sent_during_an_interview_json(client):
    sid, body = start(client, "interview")
    assert body["feedback_mode"] == "interview"
    answer = client.post(f"/sessions/{sid}/turn", data={"text": TEXT}).json()
    assert answer["corrections"] == [] and answer["sentence_status"] is None and answer["praise"] is None
    assert answer["reply"].startswith("I see.")
    detail = client.get(f"/sessions/{sid}").json()
    assert detail["feedback_mode"] == "interview"
    turn = detail["turns"][0]
    assert turn["corrections"] == [] and turn["sentence_status"] is None and turn["praise"] is None


def test_nothing_is_sent_during_an_interview_stream(client):
    sid, _ = start(client, "interview")
    r = client.post(f"/sessions/{sid}/turn", headers={"Accept": "text/event-stream"}, data={"text": TEXT})
    events = sse(r)
    assert "corrections" not in events
    assert events["done"]["corrections"] == [] and events["done"]["sentence_status"] is None and events["done"]["praise"] is None
    assert "to study" not in r.text and "Clear goal" not in r.text


def test_hints_and_say_it_again_are_closed_until_the_report(client):
    sid, _ = start(client, "interview")
    client.post(f"/sessions/{sid}/turn", data={"text": TEXT})
    assert client.post(f"/sessions/{sid}/hint", json={"type": "starter"}).status_code == 409
    repeat = client.post(f"/sessions/{sid}/repeat", data={"turn": "0"}, files={"audio": ("r.webm", b"x", "audio/webm")})
    assert repeat.status_code == 409


def test_the_report_and_the_reloaded_session_contain_everything(client):
    sid, _ = start(client, "interview")
    client.post(f"/sessions/{sid}/turn", data={"text": TEXT})
    report = client.post(f"/sessions/{sid}/end").json()
    assert report["feedback_mode"] == "interview"
    student = next(line for line in report["lines"] if line["role"] == "student")
    assert [c["fixed"] for c in student["corrections"]] == ["to study"] and student["status"] == "orange"
    turn = client.get(f"/sessions/{sid}").json()["turns"][0]
    assert turn["corrections"][0]["fixed"] == "to study" and turn["sentence_status"] == "orange"
    assert turn["praise"] == "Clear goal: you go to the US."


def test_practice_is_unchanged(client):
    sid, _ = start(client, "practice")
    answer = client.post(f"/sessions/{sid}/turn", data={"text": TEXT}).json()
    assert answer["corrections"][0]["fixed"] == "to study" and answer["sentence_status"] == "orange"
    assert answer["praise"] == "Clear goal: you go to the US."
    assert client.post(f"/sessions/{sid}/hint", json={"type": "starter"}).status_code in (200, 429, 503)


def finish_interview(client, mode, answers):
    sid, _ = start(client, mode, n=answers)
    for _ in range(answers):
        client.post(f"/sessions/{sid}/turn", data={"text": TEXT})
    return sid, client.post(f"/sessions/{sid}/end").json()


def test_a_finished_interview_gets_a_verdict_in_the_report_and_when_it_is_opened_again(client):
    sid, report = finish_interview(client, "interview", 3)
    # 3 corrections in 18 words = 16.7 per 100 (red); 6 words per answer is orange; typed: no hesitations
    assert report["verdict"]["status"] == "not_yet"
    assert [(r["metric"], r["level"]) for r in report["verdict"]["reasons"]] == [("mistakes_per_100", "red"), ("words_per_answer", "orange")]
    assert client.get(f"/sessions/{sid}").json()["verdict"] == report["verdict"]


def test_no_verdict_with_fewer_than_three_answers_or_before_the_end(client):
    _, short = finish_interview(client, "interview", 2)
    assert short["verdict"] is None
    _, short_practice = finish_interview(client, "practice", 2)
    assert short_practice["verdict"] is None
    running, _ = start(client, "interview", n=3)
    client.post(f"/sessions/{running}/turn", data={"text": TEXT})
    assert client.get(f"/sessions/{running}").json()["verdict"] is None


def test_a_practice_session_gets_the_same_verdict_so_a_visitor_who_only_practises_sees_it(client):
    sid, report = finish_interview(client, "practice", 3)
    assert report["feedback_mode"] == "practice" and report["verdict"]["status"] == "not_yet"
    assert client.get(f"/sessions/{sid}").json()["verdict"] == report["verdict"]
