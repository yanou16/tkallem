import base64
import json

import httpx
import pytest

from app.config import settings
from app.voice import SttError, TtsError, synthesize, transcribe
from app.voice.tts import split_text

AUDIO = b"RIFF-fake-audio-bytes"
WORDS = [
    {"word": "I", "start": 0.0, "end": 0.2},
    {"word": "go", "start": 0.3, "end": 0.5},
    {"word": "to", "start": 1.5, "end": 1.6},  # 1.0 s of silence before "to"
    {"word": "study", "start": 1.7, "end": 2.1},
]


@pytest.fixture(autouse=True)
def keys(monkeypatch):
    monkeypatch.setattr(settings, "groq_api_key", "gsk_test")
    monkeypatch.setattr(settings, "deepinfra_api_key", "di_test")


def client(handler):
    return httpx.Client(transport=httpx.MockTransport(handler))


def test_groq_transcription_request_and_words():
    seen = {}

    def handler(request: httpx.Request):
        seen["url"], seen["auth"], seen["body"] = str(request.url), request.headers["authorization"], request.content
        return httpx.Response(200, json={"text": " I go to study. ", "duration": 2.4, "words": WORDS})

    t = transcribe(AUDIO, "a.webm", "audio/webm", provider="groq", keep_fillers=True, client=client(handler))
    assert seen["url"] == "https://api.groq.com/openai/v1/audio/transcriptions"
    assert seen["auth"] == "Bearer gsk_test"
    for expected in (b"whisper-large-v3-turbo", b"verbose_json", b"timestamp_granularities[]", b"word", b"Umm, let me think", AUDIO):
        assert expected in seen["body"]
    assert t.text == "I go to study." and t.provider == "groq" and t.duration_s == 2.4
    assert [w["text"] for w in t.words] == ["I", "go", "to", "study"]
    assert t.long_pauses() == 1 and t.long_pauses(min_gap=1.5) == 0


def test_filler_prompt_is_off_by_default():
    bodies = []
    for keep in (False, None):
        kwargs = {} if keep is None else {"keep_fillers": keep}
        transcribe(AUDIO, provider="groq", client=client(lambda r: bodies.append(r.content) or httpx.Response(200, json={"text": "x"})), **kwargs)
    assert all(b"Umm" not in b for b in bodies)


def test_deepinfra_transcription_uses_its_own_endpoint_and_length_in_ms():
    seen = {}

    def handler(request: httpx.Request):
        seen["url"], seen["auth"] = str(request.url), request.headers["authorization"]
        return httpx.Response(200, json={"text": "hello", "input_length_ms": 3200, "words": [{"text": "hello", "start": 0, "end": 1}]})

    t = transcribe(AUDIO, provider="deepinfra", client=client(handler))
    assert seen["url"] == "https://api.deepinfra.com/v1/inference/openai/whisper-large-v3-turbo"
    assert seen["auth"] == "bearer di_test" and t.duration_s == 3.2 and t.words[0]["text"] == "hello"


def test_stt_errors_are_wrapped_and_never_leak_the_key():
    for status in (401, 429, 500):
        with pytest.raises(SttError, match=str(status)) as e:
            transcribe(AUDIO, provider="groq", client=client(lambda r, s=status: httpx.Response(s, text="gsk_test secret")))
        assert "gsk_test" not in str(e.value)

    def boom(request):
        raise httpx.ConnectTimeout("slow")

    with pytest.raises(SttError, match="ConnectTimeout"):
        transcribe(AUDIO, provider="groq", client=client(boom))
    with pytest.raises(SttError, match="not JSON|failed"):
        transcribe(AUDIO, provider="groq", client=client(lambda r: httpx.Response(200, text="<html>")))


def test_provider_message_is_shown_and_the_key_is_hidden():
    body = {"error": {"message": "The model requires terms acceptance. Key gsk_test was used."}}
    with pytest.raises(TtsError, match="terms acceptance") as e:
        synthesize("hi", provider="groq", client=client(lambda r: httpx.Response(400, json=body)))
    assert "gsk_test" not in str(e.value) and "<key>" in str(e.value)
    with pytest.raises(TtsError, match="positive balance"):
        synthesize("hi", provider="deepinfra", client=client(lambda r: httpx.Response(402, json={"detail": {"error": "You need positive balance"}})))
    with pytest.raises(SttError, match="502$"):
        transcribe(AUDIO, provider="groq", client=client(lambda r: httpx.Response(502, text="")))


def test_stt_input_checks(monkeypatch):
    with pytest.raises(SttError, match="empty"):
        transcribe(b"", provider="groq")
    with pytest.raises(SttError, match="unknown"):
        transcribe(AUDIO, provider="whisperx")
    monkeypatch.setattr(settings, "max_audio_bytes", 5)
    with pytest.raises(SttError, match="too large"):
        transcribe(AUDIO, provider="groq")
    monkeypatch.setattr(settings, "groq_api_key", "")
    monkeypatch.setattr(settings, "max_audio_bytes", 5_000_000)
    with pytest.raises(SttError, match="GROQ_API_KEY"):
        transcribe(AUDIO, provider="groq")


@pytest.mark.parametrize("audio_field", [
    base64.b64encode(AUDIO).decode(),
    "data:audio/wav;base64," + base64.b64encode(AUDIO).decode(),
])
def test_deepinfra_tts_decodes_base64_and_data_uri(audio_field):
    seen = {}

    def handler(request: httpx.Request):
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json={"audio": audio_field, "output_format": "wav", "input_character_length": 20})

    s = synthesize("Good. What is your plan?", provider="deepinfra", client=client(handler))
    assert s.parts == [AUDIO] and s.mime == "audio/wav" and s.provider == "deepinfra"
    assert seen["body"] == {"text": "Good. What is your plan?"}
    assert s.chars == 24 and round(s.cost_usd, 8) == round(24 * 0.99 / 1e6, 8)


def test_deepinfra_tts_downloads_an_audio_url_and_rejects_empty_audio():
    def handler(request: httpx.Request):
        if request.url.host == "cdn.example.com":
            return httpx.Response(200, content=AUDIO)
        return httpx.Response(200, json={"audio": "https://cdn.example.com/a.mp3", "output_format": "mp3"})

    s = synthesize("Hello there.", provider="deepinfra", client=client(handler))
    assert s.parts == [AUDIO] and s.mime == "audio/mpeg"
    with pytest.raises(TtsError, match="no audio"):
        synthesize("Hello.", provider="deepinfra", client=client(lambda r: httpx.Response(200, json={"audio": None})))


def test_groq_tts_splits_long_replies_and_calls_the_documented_endpoint():
    calls = []

    def handler(request: httpx.Request):
        calls.append((str(request.url), json.loads(request.content)))
        return httpx.Response(200, content=AUDIO)

    long_reply = "Good. " + "That is an interesting plan for your future studies. " * 6 + "What will you do next?"
    s = synthesize(long_reply, provider="groq", client=client(handler))
    assert len(s.parts) == len(calls) > 1 and s.mime == "audio/wav"
    assert all(url == "https://api.groq.com/openai/v1/audio/speech" for url, _ in calls)
    assert all(len(body["input"]) <= 190 and body["voice"] == "hannah" and body["model"] == "canopylabs/orpheus-v1-english" for _, body in calls)
    assert s.first_part_s <= s.latency_s and round(s.cost_usd, 6) == round(s.chars * 22 / 1e6, 6)


def test_tts_errors_and_input_checks(monkeypatch):
    with pytest.raises(TtsError, match="empty"):
        synthesize("  ", provider="groq")
    with pytest.raises(TtsError, match="unknown"):
        synthesize("hi", provider="elevenlabs")
    with pytest.raises(TtsError, match="429"):
        synthesize("hi", provider="deepinfra", client=client(lambda r: httpx.Response(429)))
    monkeypatch.setattr(settings, "deepinfra_api_key", "")
    with pytest.raises(TtsError, match="DEEPINFRA_API_KEY"):
        synthesize("hi", provider="deepinfra")


def test_split_text_respects_the_limit_and_keeps_every_word():
    text = "One. " * 5 + "x" * 450 + " end."
    chunks = split_text(text, limit=100)
    assert all(len(c) <= 100 for c in chunks)
    assert "".join("".join(chunks).split()) == "".join(text.split())
    assert split_text("Short reply.") == ["Short reply."]


def test_garbled_or_foreign_transcription_is_unclear():
    from app.voice.stt import Transcription
    assert Transcription("Jale Kailt útíu að heyra stórk.", "groq", 0.4).unclear
    assert not Transcription("I would like to study in the US.", "groq", 0.4).unclear
    low = [{"avg_logprob": -1.4, "no_speech_prob": 0.1}]
    assert Transcription("Maybe it was ok.", "groq", 0.4, segments=low).unclear
    silent = [{"avg_logprob": -0.3, "no_speech_prob": 0.9}]
    assert Transcription("Thank you.", "groq", 0.4, segments=silent).unclear
    good = [{"avg_logprob": -0.2, "no_speech_prob": 0.01}]
    assert not Transcription("I live in Algiers.", "groq", 0.4, segments=good).unclear


def test_accented_algerian_place_names_are_not_mistaken_for_noise():
    from app.voice.stt import Transcription
    assert not Transcription("I live in Béjaïa.", "groq", 0.4).unclear
    assert not Transcription("I am from Sétif and I studied in Médéa.", "groq", 0.4).unclear
    assert not Transcription("I drink a café crème every morning.", "groq", 0.4).unclear
