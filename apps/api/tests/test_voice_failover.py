"""Voice providers back each other up: a rate limit during the demo must cost a second, not the voice."""
import httpx
import pytest

from app.config import settings
from app.voice import SttError, TtsError, failover, stt, tts


@pytest.fixture(autouse=True)
def clean(monkeypatch):
    failover.reset()
    monkeypatch.setattr(settings, "tts_provider", "groq,deepinfra")
    monkeypatch.setattr(settings, "stt_provider", "groq,deepinfra")
    yield
    failover.reset()


def fake_tts(calls, outcomes):
    def make(name):
        def run(client, text, voice, factor=1.0):
            calls.append(name)
            out = outcomes[name]
            if isinstance(out, Exception):
                raise out
            return [b"wav"], "audio/wav", [0.1]
        return run
    return {n: make(n) for n in outcomes}


def test_tts_falls_back_when_the_first_provider_is_rate_limited(monkeypatch):
    calls = []
    monkeypatch.setattr(tts, "PROVIDERS", fake_tts(calls, {"groq": TtsError("groq answered 429", 429), "deepinfra": None}))
    assert tts.synthesize("Hello there.").provider == "deepinfra"
    assert calls == ["groq", "deepinfra"]


def test_a_provider_that_failed_rests_and_is_not_retried_on_the_next_turn(monkeypatch):
    calls = []
    monkeypatch.setattr(tts, "PROVIDERS", fake_tts(calls, {"groq": TtsError("quota", 429), "deepinfra": None}))
    tts.synthesize("One.")
    calls.clear()
    assert tts.synthesize("Two.").provider == "deepinfra"
    assert calls == ["deepinfra"]  # groq is resting


def test_a_resting_provider_is_still_tried_as_last_resort(monkeypatch):
    calls = []
    monkeypatch.setattr(tts, "PROVIDERS", fake_tts(calls, {"groq": None, "deepinfra": TtsError("no balance", 402)}))
    failover.mark_down("tts", "groq", 429)
    assert tts.synthesize("Hi.").provider == "groq"  # deepinfra fails too: groq answers although it was resting
    assert calls == ["deepinfra", "groq"]


def test_tts_raises_only_when_every_provider_failed(monkeypatch):
    monkeypatch.setattr(tts, "PROVIDERS", fake_tts([], {"groq": TtsError("a", 429), "deepinfra": TtsError("b", 402)}))
    with pytest.raises(TtsError, match="a; b"):
        tts.synthesize("Hi.")


def test_missing_key_is_skipped_without_resting_the_provider(monkeypatch):
    monkeypatch.setattr(tts, "PROVIDERS", fake_tts([], {"groq": TtsError("GROQ_API_KEY is not set"), "deepinfra": None}))
    assert tts.synthesize("Hi.").provider == "deepinfra"
    assert failover.ordered("tts", ["groq", "deepinfra"]) == ["groq", "deepinfra"]


def test_an_explicit_provider_is_never_replaced(monkeypatch):
    calls = []
    monkeypatch.setattr(tts, "PROVIDERS", fake_tts(calls, {"groq": TtsError("x", 429), "deepinfra": None}))
    with pytest.raises(TtsError):
        tts.synthesize("Hi.", provider="groq")
    assert calls == ["groq"]


def fake_stt(calls, outcomes):
    def make(name):
        def run(client, audio, filename, ctype, language, fillers):
            calls.append(name)
            out = outcomes[name]
            if isinstance(out, Exception):
                raise out
            return "I live in Algiers.", 3.0, [], []
        return run
    return {n: make(n) for n in outcomes}


def test_stt_falls_back_to_the_second_provider(monkeypatch):
    calls = []
    monkeypatch.setattr(stt, "PROVIDERS", fake_stt(calls, {"groq": SttError("groq answered 429", 429), "deepinfra": None}))
    heard = stt.transcribe(b"audio")
    assert heard.provider == "deepinfra" and heard.text == "I live in Algiers."


def test_unreadable_audio_is_reported_as_the_students_problem_only_if_all_agree(monkeypatch):
    monkeypatch.setattr(stt, "PROVIDERS", fake_stt([], {"groq": SttError("bad", 400), "deepinfra": SttError("bad", 422)}))
    with pytest.raises(SttError) as e:
        stt.transcribe(b"audio")
    assert e.value.bad_audio
    failover.reset()
    monkeypatch.setattr(stt, "PROVIDERS", fake_stt([], {"groq": SttError("bad", 400), "deepinfra": SttError("down", 500)}))
    with pytest.raises(SttError) as e:
        stt.transcribe(b"audio")
    assert not e.value.bad_audio  # one provider is down: not the student's fault


def test_a_connection_failure_is_retried_once_on_the_same_provider(monkeypatch):
    calls = []

    def flaky(client, text, voice, factor=1.0):
        calls.append("groq")
        if len(calls) == 1:
            raise httpx.ConnectTimeout("no route")
        return [b"wav"], "audio/wav", [0.1]

    monkeypatch.setattr(tts, "PROVIDERS", {"groq": flaky, "deepinfra": lambda *a: (_ for _ in ()).throw(AssertionError("not needed"))})
    assert tts.synthesize("Hi.").provider == "groq"
    assert calls == ["groq", "groq"]


def test_a_refusal_is_not_retried_on_the_same_provider(monkeypatch):
    calls = []
    monkeypatch.setattr(tts, "PROVIDERS", fake_tts(calls, {"groq": TtsError("quota", 429), "deepinfra": None}))
    tts.synthesize("Hi.")
    assert calls == ["groq", "deepinfra"]


def test_stt_connection_failure_retried_then_falls_back(monkeypatch):
    calls = []

    def down(client, audio, filename, ctype, language, fillers):
        calls.append("groq")
        raise httpx.ConnectError("refused")

    monkeypatch.setattr(stt, "PROVIDERS", {"groq": down, **fake_stt(calls, {"deepinfra": None})})
    assert stt.transcribe(b"audio").provider == "deepinfra"
    assert calls == ["groq", "groq", "deepinfra"]


def test_a_provider_that_keeps_timing_out_rests_longer_each_time_and_a_success_resets_it():
    failover.reset()
    rests = []
    for _ in range(5):
        failover.mark_down("tts", "deepinfra", None, now=1000.0)
        rests.append(failover._down_until[("tts", "deepinfra")] - 1000.0)
    assert rests == [20.0, 60.0, 180.0, 300.0, 300.0]
    failover.mark_ok("tts", "deepinfra")
    failover.mark_down("tts", "deepinfra", None, now=1000.0)
    assert failover._down_until[("tts", "deepinfra")] - 1000.0 == 20.0
    failover.mark_down("tts", "groq", 429, now=1000.0)  # a quota stays 5 minutes at once
    assert failover._down_until[("tts", "groq")] - 1000.0 == 300.0
    failover.reset()
