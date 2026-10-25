"""The voice that runs on the server: the safety net when the other voices are over their limit or slow."""
import sys
import types
import wave

import pytest

from app.config import settings
from app.voice import failover, tts
from app.voice.tts import TtsError


@pytest.fixture(autouse=True)
def clean(monkeypatch):
    failover.reset()
    monkeypatch.setattr(tts, "_piper_voice", None)
    yield
    failover.reset()


def fake_piper(monkeypatch, tmp_path, fail=None):
    model = tmp_path / "voice.onnx"
    model.write_bytes(b"x")
    monkeypatch.setattr(settings, "piper_model_path", str(model))

    class Voice:
        @staticmethod
        def load(path):
            return Voice()

        def synthesize_wav(self, text, wav):
            if fail:
                raise fail
            wav.setnchannels(1), wav.setsampwidth(2), wav.setframerate(22050)
            wav.writeframes(b"\x01\x02" * 2205)  # 0.1 s

    monkeypatch.setitem(sys.modules, "piper", types.SimpleNamespace(PiperVoice=Voice))


def test_piper_says_a_line_as_a_wav_file_and_costs_nothing(monkeypatch, tmp_path):
    fake_piper(monkeypatch, tmp_path)
    monkeypatch.setattr(settings, "tts_provider", "piper")
    speech = tts.synthesize("What is the purpose of your trip?")
    assert speech.provider == "piper" and speech.cost_usd == 0 and speech.mime == "audio/wav"
    with wave.open(__import__("io").BytesIO(speech.audio)) as w:
        assert w.getframerate() == 22050 and w.getnframes() == 2205


def test_piper_is_the_safety_net_it_answers_only_when_the_two_others_failed(monkeypatch, tmp_path):
    fake_piper(monkeypatch, tmp_path)
    monkeypatch.setattr(settings, "tts_provider", "groq,deepinfra,piper")
    calls = []

    def groq(client, text, voice, factor=1.0):
        calls.append("groq")
        raise TtsError("groq answered 429", 429)

    def deepinfra(client, text, voice, factor=1.0):
        calls.append("deepinfra")
        raise TtsError("deepinfra failed: ReadTimeout")

    monkeypatch.setattr(tts, "PROVIDERS", {**tts.PROVIDERS, "groq": groq, "deepinfra": deepinfra})
    assert tts.synthesize("Hello.").provider == "piper"
    assert calls == ["groq", "deepinfra"]
    # both are resting now: the next line goes straight to the voice that runs here
    calls.clear()
    assert tts.synthesize("Hello again.").provider == "piper"
    assert calls == []


def test_when_groq_works_piper_is_never_asked(monkeypatch, tmp_path):
    fake_piper(monkeypatch, tmp_path)
    monkeypatch.setattr(settings, "tts_provider", "groq,deepinfra,piper")
    monkeypatch.setattr(tts, "PROVIDERS", {**tts.PROVIDERS, "groq": lambda c, t, v, f=1.0: ([b"x"], "audio/wav", [1.0])})
    assert tts.synthesize("Hello.").provider == "groq"


def test_a_missing_voice_file_skips_piper_without_resting_it(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "piper_model_path", str(tmp_path / "missing.onnx"))
    monkeypatch.setattr(settings, "tts_provider", "piper,deepinfra")
    monkeypatch.setattr(tts, "PROVIDERS", {**tts.PROVIDERS, "deepinfra": lambda c, t, v, f=1.0: ([b"x"], "audio/wav", [1.0])})
    assert tts.synthesize("Hello.").provider == "deepinfra"
    assert failover.ordered("tts", ["piper", "deepinfra"])[0] == "piper"  # not resting: a configuration choice, not an outage


def test_a_voice_that_cannot_say_the_text_gives_way_to_the_next_provider(monkeypatch, tmp_path):
    fake_piper(monkeypatch, tmp_path, fail=RuntimeError("phonemizer"))
    monkeypatch.setattr(settings, "tts_provider", "piper,deepinfra")
    monkeypatch.setattr(tts, "PROVIDERS", {**tts.PROVIDERS, "deepinfra": lambda c, t, v, f=1.0: ([b"x"], "audio/wav", [1.0])})
    assert tts.synthesize("Hello.").provider == "deepinfra"


def test_the_default_chain_ends_with_piper():
    assert settings.model_fields["tts_provider"].default == "groq,deepinfra,piper"


def test_warm_up_loads_the_voice_once_and_never_raises(monkeypatch, tmp_path):
    fake_piper(monkeypatch, tmp_path)
    monkeypatch.setattr(settings, "tts_provider", "groq,deepinfra,piper")
    assert tts._piper_voice is None
    tts.warm_up_piper()
    assert tts._piper_voice is not None  # loaded: the first call of a deploy does not pay for it


def test_warm_up_does_nothing_without_piper_in_the_chain_or_without_the_file(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "tts_provider", "groq,deepinfra")
    tts.warm_up_piper()
    assert tts._piper_voice is None
    monkeypatch.setattr(settings, "tts_provider", "piper")
    monkeypatch.setattr(settings, "piper_model_path", str(tmp_path / "missing.onnx"))
    tts.warm_up_piper()  # logs, does not raise
    assert tts._piper_voice is None
