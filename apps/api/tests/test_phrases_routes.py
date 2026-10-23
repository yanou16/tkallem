"""GET /me/corrections ("Phrases"): the student's corrected answers from all their sessions, with the index that
"Say it again" takes. No network: the model is a FakeChat."""
from contextlib import nullcontext

import pytest
from fastapi.testclient import TestClient

from app.db.connection import get_conn, get_conn_factory
from app.db.users import get_or_create_by_clerk_id, update_profile
from app.main import app
from app.routes.sessions import get_llm
from app.security import ClerkClaims, get_clerk_claims
from tkallem_agent.testing import FakeChat

FIX = {"original": "for study", "fixed": "to study", "type": "grammar", "why": "Le but : to + verbe."}
FIX2 = {"original": "My father pay", "fixed": "My father pays", "type": "grammar", "why": "He/she + s."}
CLEAN = {"corrections": [], "praise": None}
USER = {"id": "user_phrases_a"}


@pytest.fixture
def client(db):
    app.dependency_overrides[get_clerk_claims] = lambda: ClerkClaims(user_id=USER["id"], session_id=None)
    app.dependency_overrides[get_conn] = lambda: db
    app.dependency_overrides[get_conn_factory] = lambda: (lambda: nullcontext(db))
    USER["id"] = "user_phrases_a"
    user = get_or_create_by_clerk_id(db, USER["id"])
    update_profile(db, user["id"], {"level": "B1"})
    yield TestClient(app)
    app.dependency_overrides.clear()


def answer(client, mode, texts, founds):
    """A session of `mode` where the student sends `texts`; `founds` is what the corrector finds in each."""
    app.dependency_overrides[get_llm] = lambda: FakeChat(
        founds, [{"reaction": "I see.", "goal_covered": "purpose_of_trip"}] * len(texts), text=["Note."])
    sid = client.post("/sessions", json={"scenario_id": "visa-us", "mode": "text", "feedback_mode": mode}).json()["session_id"]
    for text in texts:
        client.post(f"/sessions/{sid}/turn", data={"text": text})
    return sid


def test_a_corrected_answer_comes_with_its_corrected_sentence_and_the_index_say_it_again_takes(client):
    sid = answer(client, "practice", ["I go to the US for study."], [{"corrections": [FIX], "praise": None}])
    phrases = client.get("/me/corrections").json()
    assert len(phrases) == 1
    p = phrases[0]
    assert p["session_id"] == sid and p["turn"] == 0  # the index /sessions/{id}/repeat expects (0 = first answer)
    assert p["original"] == "I go to the US for study." and p["corrected"] == "I go to the US to study."
    assert p["title"] and p["title"] != "visa-us"  # the scenario's title, not its id
    assert [c["fixed"] for c in p["corrections"]] == ["to study"] and p["corrections"][0]["why"] == FIX["why"]
    assert client.get(f"/sessions/{sid}").json()["turns"][p["turn"]]["transcript"] == p["original"]


def test_an_answer_without_corrections_is_not_a_phrase(client):
    answer(client, "practice", ["I am going to the United States to study computer science."], [CLEAN])
    assert client.get("/me/corrections").json() == []


def test_several_fixes_in_one_answer_make_one_phrase(client):
    answer(client, "practice", ["My father pay my studies for study."], [{"corrections": [FIX, FIX2], "praise": None}])
    p = client.get("/me/corrections").json()[0]
    assert p["corrected"] == "My father pays my studies to study."
    assert [c["fixed"] for c in p["corrections"]] == ["My father pays", "to study"]  # in the order the sentence reads


def test_a_real_interview_in_progress_is_hidden_until_its_report(client):
    sid = answer(client, "interview", ["I go to the US for study."], [{"corrections": [FIX], "praise": None}])
    assert client.get("/me/corrections").json() == []
    client.post(f"/sessions/{sid}/end")
    assert [p["turn"] for p in client.get("/me/corrections").json()] == [0]


def test_newest_session_first_and_the_limit_is_respected(client, db):
    old = answer(client, "practice", ["I go to the US for study."], [{"corrections": [FIX], "praise": None}])
    db.execute("UPDATE practice_sessions SET started_at = started_at - interval '1 day' WHERE id = %s", (old,))  # one test = one transaction = one now()
    new = answer(client, "practice", ["I go to the US for study.", "I go to the US for study."], [{"corrections": [FIX], "praise": None}] * 2)
    assert [(p["session_id"], p["turn"]) for p in client.get("/me/corrections").json()] == [(new, 0), (new, 1), (old, 0)]
    assert len(client.get("/me/corrections?limit=2").json()) == 2
    assert client.get("/me/corrections?limit=0").status_code == 422 and client.get("/me/corrections?limit=101").status_code == 422


def test_nobody_sees_the_phrases_of_another_student(client, db):
    answer(client, "practice", ["I go to the US for study."], [{"corrections": [FIX], "praise": None}])
    USER["id"] = "user_phrases_b"
    other = get_or_create_by_clerk_id(db, USER["id"])
    update_profile(db, other["id"], {"level": "B1"})
    assert client.get("/me/corrections").json() == []


def test_a_fix_that_cannot_be_applied_is_left_out(client):
    # the corrector quoted words that are not in the sentence: there is no corrected sentence to say
    ghost = {"original": "completely other words", "fixed": "something else", "type": "grammar", "why": "x"}
    answer(client, "practice", ["I go to the US."], [{"corrections": [ghost], "praise": None}])
    assert client.get("/me/corrections").json() == []


def test_an_unfinished_practice_session_from_before_feedback_mode_was_stored_still_shows_its_phrases(client, db):
    sid = answer(client, "practice", ["I go to the US for study."], [{"corrections": [FIX], "praise": None}])
    db.execute("UPDATE practice_sessions SET state = state - 'feedback_mode' WHERE id = %s", (sid,))  # an old session: no such key
    assert [p["session_id"] for p in client.get("/me/corrections").json()] == [sid]
