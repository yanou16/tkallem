"""Voice on the session routes: spoken answers (`audio`), the coach's voice (`reply_audio_url`, data URI), and the
way the fake providers' failures degrade. No network: transcribe/synthesize are replaced in the routes module."""
import base64
import io
import struct
import wave
from contextlib import nullcontext
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.db.connection import get_conn, get_conn_factory
from app.db.users import get_or_create_by_clerk_id, update_profile
from app.main import app
from app.routes import sessions as routes
from app.routes.sessions import get_llm
from app.security import ClerkClaims, get_clerk_claims
from app.voice import SttError, TtsError
from app.voice.stt import Transcription
from app.voice.tts import Speech, merge_wav
from tests.fake_llm import FakeChat
from tkallem_agent.scenarios import load_scenario

CLERK_ID = "user_voice_test"
FOUND = {"corrections": [{"original": "for study", "fixed": "to study", "type": "grammar", "why": "Le but : to + verbe."}]}
NONE = {"corrections": []}


def wav_bytes(frames: int = 2400, rate: int = 24000) -> bytes:
    out = io.BytesIO()
    with wave.open(out, "wb") as w:
        w.setnchannels(1), w.setsampwidth(2), w.setframerate(rate)
        w.writeframes(b"\x01\x00" * frames)
    return out.getvalue()


def speech(text="x"):
    return Speech([wav_bytes()], "audio/wav", "groq", len(text), 0.9, 0.9, [0.9])


def heard(text="I go to the US for study.", duration=2.4, words=None):
    return Transcription(text, "groq", 0.4, duration, words or [])


@pytest.fixture
def client(db, monkeypatch):
    app.dependency_overrides[get_clerk_claims] = lambda: ClerkClaims(user_id=CLERK_ID, session_id=None)
    app.dependency_overrides[get_conn] = lambda: db
    app.dependency_overrides[get_conn_factory] = lambda: (lambda: nullcontext(db))
    app.dependency_overrides[get_llm] = lambda: FakeChat([FOUND], [{"reaction": "Good.", "goal_covered": None}], text=["note"])
    monkeypatch.setattr(routes, "transcribe", lambda *a, **k: heard())
    monkeypatch.setattr(routes, "synthesize", lambda text, **k: speech(text))
    import app.voice.pipeline as pipeline
    monkeypatch.setattr(pipeline, "synthesize", lambda text, **k: speech(text))
    yield TestClient(app)
    app.dependency_overrides.clear()


def start(client, db, mode):
    user = get_or_create_by_clerk_id(db, CLERK_ID)
    update_profile(db, user["id"], {"level": "B1"})
    return client.post("/sessions", json={"scenario_id": "visa-us", "mode": mode})


def send_audio(client, sid, data=b"RIFF-audio", name="answer.webm", ctype="audio/webm"):
    return client.post(f"/sessions/{sid}/turn", files={"audio": (name, data, ctype)})


def test_voice_session_speaks_the_first_question(client, db):
    body = start(client, db, "voice").json()
    uri = body["first_question"]["audio_url"]
    assert uri.startswith("data:audio/wav;base64,")
    assert wave.open(io.BytesIO(base64.b64decode(uri.split(",", 1)[1]))).getframerate() == 24000


def test_text_session_has_no_audio(client, db):
    assert start(client, db, "text").json()["first_question"]["audio_url"] is None


def test_spoken_answer_is_transcribed_corrected_and_answered_with_a_voice(client, db):
    sid = start(client, db, "voice").json()["session_id"]
    r = send_audio(client, sid)
    assert r.status_code == 200
    body = r.json()
    assert body["transcript"] == "I go to the US for study."
    assert body["corrections"][0]["fixed"] == "to study" and body["sentence_status"] == "orange"
    assert body["reply_audio_url"].startswith("data:audio/wav;base64,")
    state = db.execute("SELECT state FROM practice_sessions WHERE id = %s", (UUID(sid),)).fetchone()["state"]
    assert state["turns"][0]["audio_seconds"] == 2.4 and state["turns"][0]["pauses"] == 0


def test_long_pauses_measured_on_the_audio_are_stored_as_hesitations(client, db, monkeypatch):
    words = [{"text": "I", "start": 0, "end": .2}, {"text": "go", "start": 1.4, "end": 1.6}, {"text": "now", "start": 3.0, "end": 3.3}]
    monkeypatch.setattr(routes, "transcribe", lambda *a, **k: heard(words=words))
    sid = start(client, db, "voice").json()["session_id"]
    assert send_audio(client, sid).status_code == 200
    state = db.execute("SELECT state FROM practice_sessions WHERE id = %s", (UUID(sid),)).fetchone()["state"]
    assert state["turns"][0]["pauses"] == 2


def test_spoken_answer_in_a_text_session_still_gets_a_voice_reply(client, db):
    sid = start(client, db, "text").json()["session_id"]
    body = send_audio(client, sid).json()
    assert body["transcript"] and body["reply_audio_url"].startswith("data:audio/wav")


def test_voice_failure_never_fails_the_turn(client, db, monkeypatch):
    import app.voice.pipeline as pipeline

    def broken(text, **k):
        raise TtsError("deepinfra answered 402")

    monkeypatch.setattr(pipeline, "synthesize", broken)
    sid = start(client, db, "voice").json()["session_id"]
    r = send_audio(client, sid)
    assert r.status_code == 200 and r.json()["reply_audio_url"] is None and r.json()["reply"]


@pytest.mark.parametrize("error,expected", [(SttError("bad", 400), 422), (SttError("down", 500), 502), (SttError("quota", 429), 502)])
def test_transcription_errors_map_to_the_right_status(client, db, monkeypatch, error, expected):
    def boom(*a, **k):
        raise error

    monkeypatch.setattr(routes, "transcribe", boom)
    sid = start(client, db, "voice").json()["session_id"]
    assert send_audio(client, sid).status_code == expected
    assert db.execute("SELECT count(*) AS n FROM turns").fetchone()["n"] == 0  # nothing saved


def test_silence_returns_422_and_saves_nothing(client, db, monkeypatch):
    monkeypatch.setattr(routes, "transcribe", lambda *a, **k: heard(text="  "))
    sid = start(client, db, "voice").json()["session_id"]
    r = send_audio(client, sid)
    assert r.status_code == 422 and "hear" in r.json()["detail"]


def test_exactly_one_of_text_or_audio(client, db):
    sid = start(client, db, "voice").json()["session_id"]
    assert client.post(f"/sessions/{sid}/turn").status_code == 422
    both = client.post(f"/sessions/{sid}/turn", data={"text": "hi"}, files={"audio": ("a.webm", b"x", "audio/webm")})
    assert both.status_code == 422


def test_oversized_recording_is_refused_before_any_provider_call(client, db, monkeypatch):
    monkeypatch.setattr(settings, "max_audio_bytes", 10)
    monkeypatch.setattr(routes, "transcribe", lambda *a, **k: pytest.fail("provider must not be called"))
    sid = start(client, db, "voice").json()["session_id"]
    assert send_audio(client, sid, data=b"x" * 11).status_code == 413


def test_session_checks_come_before_the_audio_is_sent_to_a_provider(client, db, monkeypatch):
    monkeypatch.setattr(routes, "transcribe", lambda *a, **k: pytest.fail("provider must not be called"))
    assert send_audio(client, "00000000-0000-0000-0000-000000000000").status_code == 404


def streaming_wav(frames: int = 1000, rate: int = 24000) -> bytes:
    """What Groq sends: sizes set to 0xFFFFFFFF and an extra chunk before the samples."""
    pcm = b"\x02\x00" * frames
    fmt = struct.pack("<4sIHHIIHH", b"fmt ", 16, 1, 1, rate, rate * 2, 2, 16)
    extra = b"LIST" + struct.pack("<I", 4) + b"INFO"
    return b"RIFF" + struct.pack("<I", 0xFFFFFFFF) + b"WAVE" + fmt + extra + b"data" + struct.pack("<I", 0xFFFFFFFF) + pcm


def test_streaming_wav_header_is_repaired_with_the_right_duration():
    fixed = Speech([streaming_wav(24000)], "audio/wav", "groq", 5, 1, 1, [1]).audio
    w = wave.open(io.BytesIO(fixed))  # the stdlib reader would fail or lie on the original
    assert w.getnframes() == 24000 and w.getframerate() == 24000 and w.getnchannels() == 1
    assert struct.unpack("<I", fixed[4:8])[0] == len(fixed) - 8
    assert Speech([streaming_wav(24000)], "audio/wav", "groq", 5, 1, 1, [1]).data_uri.startswith("data:audio/wav;base64,")


def test_merge_wav_joins_parts_and_rejects_mixed_formats():
    merged = merge_wav([wav_bytes(100), streaming_wav(300)])
    assert wave.open(io.BytesIO(merged)).getnframes() == 400
    with pytest.raises(TtsError, match="different formats"):
        merge_wav([wav_bytes(100, 24000), wav_bytes(100, 16000)])
    with pytest.raises(TtsError, match="unreadable"):
        merge_wav([b"not a wav", b"neither"])


def test_switching_to_voice_speaks_the_last_coach_line_and_makes_replies_spoken(client, db, monkeypatch):
    spoken = []
    monkeypatch.setattr(routes, "synthesize", lambda text, **k: spoken.append(text) or speech(text))
    sid = start(client, db, "text").json()["session_id"]

    body = client.post(f"/sessions/{sid}/speak").json()

    first = load_scenario("visa-us").questions[0]
    assert body["text"] == first and spoken == [first]
    assert body["audio_url"].startswith("data:audio/wav;base64,")
    assert db.execute("SELECT mode FROM practice_sessions WHERE id = %s", (UUID(sid),)).fetchone()["mode"] == "voice"
    typed = client.post(f"/sessions/{sid}/turn", data={"text": "I go to the US for study."}).json()
    assert typed["reply_audio_url"].startswith("data:audio/wav")  # a typed answer in a voice session is answered aloud


def test_speak_degrades_to_text_and_is_limited_per_session(client, db, monkeypatch):
    def broken(text, **k):
        raise TtsError("groq answered 429")
    monkeypatch.setattr(routes, "synthesize", broken)
    monkeypatch.setattr(routes, "SPEAK_LIMIT", 2)
    sid = start(client, db, "text").json()["session_id"]
    first = client.post(f"/sessions/{sid}/speak")
    assert first.status_code == 200 and first.json()["audio_url"] is None
    assert client.post(f"/sessions/{sid}/speak").status_code == 200
    assert client.post(f"/sessions/{sid}/speak").status_code == 429


def test_speak_only_for_the_owner(client, db):
    sid = start(client, db, "text").json()["session_id"]
    app.dependency_overrides[get_clerk_claims] = lambda: ClerkClaims(user_id="user_other_voice", session_id=None)
    assert client.post(f"/sessions/{sid}/speak").status_code == 404


@pytest.mark.parametrize("noise", ["", " . ", "...", "♪"])
def test_a_transcript_without_words_is_refused_and_costs_nothing(client, db, monkeypatch, noise):
    monkeypatch.setattr(routes, "transcribe", lambda *a, **k: heard(text=noise))
    sid = start(client, db, "voice").json()["session_id"]
    before = db.execute("SELECT count(*) AS n FROM turns WHERE session_id = %s", (UUID(sid),)).fetchone()["n"]
    r = send_audio(client, sid)
    assert r.status_code == 422 and "did not hear" in r.json()["detail"]
    assert db.execute("SELECT count(*) AS n FROM turns WHERE session_id = %s", (UUID(sid),)).fetchone()["n"] == before
