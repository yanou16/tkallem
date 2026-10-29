"""Azure Speech neural voice: the first voice of the chain, Piper right behind it."""
import httpx
import pytest

from app.config import settings
from app.voice import failover, tts
from app.voice.tts import TtsError

WAV = b"RIFF\x24\x00\x00\x00WAVEfmt " + b"\x00" * 20


@pytest.fixture(autouse=True)
def clean(monkeypatch):
    failover.reset()
    monkeypatch.setattr(settings, "azure_speech_key", "test-key")
    monkeypatch.setattr(settings, "tts_provider", "azure")
    yield
    failover.reset()


def client_answering(status=200, content=WAV, seen=None):
    def handler(request: httpx.Request) -> httpx.Response:
        if seen is not None:
            seen.append(request)
        return httpx.Response(status, content=content)

    return httpx.Client(transport=httpx.MockTransport(handler))


def test_azure_sends_ssml_with_the_chosen_voice_and_asks_for_wav():
    seen: list[httpx.Request] = []
    speech = tts.synthesize("Why Canada & not France?", client=client_answering(seen=seen))
    req = seen[0]
    assert req.url.host == "germanywestcentral.tts.speech.microsoft.com"
    assert req.headers["Ocp-Apim-Subscription-Key"] == "test-key"
    assert req.headers["X-Microsoft-OutputFormat"] == "riff-24khz-16bit-mono-pcm"
    body = req.content.decode()
    assert "en-US-AndrewMultilingualNeural" in body and "Why Canada &amp; not France?" in body  # text is escaped
    assert speech.provider == "azure" and speech.mime == "audio/wav" and speech.cost_usd == 0


def test_a_voice_name_meant_for_another_provider_is_not_sent_to_azure():
    seen: list[httpx.Request] = []
    tts.synthesize("Hello.", voice="hannah", client=client_answering(seen=seen))
    assert "hannah" not in seen[0].content.decode()


def test_no_key_skips_azure_without_resting_it(monkeypatch):
    monkeypatch.setattr(settings, "azure_speech_key", "")
    monkeypatch.setattr(settings, "tts_provider", "azure,deepinfra")
    monkeypatch.setattr(tts, "PROVIDERS", {**tts.PROVIDERS, "deepinfra": lambda c, t, v, f=1.0: ([b"x"], "audio/wav", [1.0])})
    assert tts.synthesize("Hello.").provider == "deepinfra"
    assert failover.ordered("tts", ["azure", "deepinfra"])[0] == "azure"


def test_quota_exhausted_429_hands_over_to_piper_and_rests_azure(monkeypatch):
    monkeypatch.setattr(settings, "tts_provider", "azure,piper,groq,deepinfra")
    calls = []

    def piper(client, text, voice, factor=1.0):
        calls.append("piper")
        return [b"x"], "audio/wav", [0.1]

    monkeypatch.setattr(tts, "PROVIDERS", {**tts.PROVIDERS, "piper": piper})
    over = client_answering(status=429, content=b"")
    assert tts.synthesize("Hello.", client=over).provider == "piper"
    calls.clear()
    assert tts.synthesize("Hello again.", client=over).provider == "piper"  # azure rests: no second wasted request
    assert failover.ordered("tts", ["azure", "piper"])[0] == "piper"


def test_an_answer_that_is_not_audio_is_a_failure():
    with pytest.raises(TtsError, match="no WAV audio"):
        tts.synthesize("Hello.", client=client_answering(content=b"<html>oops</html>"))
