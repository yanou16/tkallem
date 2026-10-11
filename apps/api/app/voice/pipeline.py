"""One voice turn: the agent answers, and the coach's voice is started as soon as its reply is known, while the
corrections are still being computed (the reply event comes first, see CoachSession.turn_events)."""
import logging
from collections.abc import Callable
from concurrent.futures import Future, ThreadPoolExecutor
from queue import Queue
from dataclasses import dataclass, field

from tkallem_agent import CoachSession
from tkallem_agent.schemas import AgentTurn

from app.voice.tts import Speech, TtsError, synthesize

logger = logging.getLogger(__name__)
_POOL = ThreadPoolExecutor(max_workers=32, thread_name_prefix="tkallem-voice")  # TTS calls and streamed agent runs


@dataclass
class VoiceTurn:
    turn: AgentTurn
    speech: Speech | None  # None: text session, or the voice failed (the text answer is still returned)
    timings: dict = field(default_factory=dict)


def run_turn(
    coach: CoachSession,
    text: str,
    *,
    audio_seconds: float | None = None,
    pauses: int = 0,
    want_audio: bool = False,
    synth: Callable[[str], Speech] | None = None,
) -> VoiceTurn:
    """Raises AgentError / ValueError like CoachSession.turn. A TTS failure never fails the turn."""
    synth = synth or synthesize
    future: Future | None = None
    turn: AgentTurn | None = None
    try:
        for event in coach.turn_events(text, audio_seconds, pauses):
            if event["type"] == "reply" and want_audio and future is None:
                future = _POOL.submit(synth, event["reply"])  # starts now, in parallel with the corrector
            elif event["type"] == "done":
                turn = event["turn"]
    except Exception:
        if future is not None:
            future.cancel()
        raise
    assert turn is not None  # turn_events ends with "done" or raises
    speech, tts_error = None, None
    if future is not None:
        try:
            speech = future.result()
        except TtsError as e:
            tts_error = str(e)
            logger.warning("TTS failed, answering with text only: %s", e)
        except Exception:  # unexpected: still never fail the turn because of the voice
            tts_error = "unexpected"
            logger.exception("TTS crashed, answering with text only")
    timings = {**coach.last_timings, "tts_s": speech.latency_s if speech else None, "tts_error": tts_error}
    return VoiceTurn(turn, speech, timings)


def stream_turn(
    coach: CoachSession,
    text: str,
    *,
    audio_seconds: float | None = None,
    pauses: int = 0,
    want_audio: bool = False,
    synth: Callable[[str], Speech] | None = None,
):
    """Same work as run_turn, but each part is yielded as soon as it exists, so the app can show the coach's text
    and play its voice without waiting for the corrections or for the rest of the work:

        {"type": "reply", "reply"}  {"type": "corrections", ...}  {"type": "audio", "speech", "error"}  {"type": "done", "turn", "timings"}

    "audio" (only with want_audio) may come before or after "corrections" and "done"; the generator ends after both
    "done" and "audio". Raises AgentError / ValueError like CoachSession.turn, possibly after "reply" was yielded.
    A voice failure never fails the turn: "audio" then has speech None."""
    synth = synth or synthesize
    events: Queue = Queue()

    def speak(reply: str) -> None:
        try:
            events.put({"type": "audio", "speech": synth(reply), "error": None})
        except TtsError as e:
            logger.warning("TTS failed, answering with text only: %s", e)
            events.put({"type": "audio", "speech": None, "error": str(e)})
        except Exception:  # never fail the turn because of the voice
            logger.exception("TTS crashed, answering with text only")
            events.put({"type": "audio", "speech": None, "error": "unexpected"})

    def agent() -> None:
        try:
            for event in coach.turn_events(text, audio_seconds, pauses):
                events.put(event)  # "reply" is queued before its voice is started, so the consumer expects the audio
                if event["type"] == "reply" and want_audio:
                    _POOL.submit(speak, event["reply"])
        except Exception as e:
            events.put({"type": "error", "error": e})

    _POOL.submit(agent)
    done, expect_audio, got_audio = False, False, False
    while not (done and (got_audio or not expect_audio)):
        event = events.get()
        if event["type"] == "error":
            raise event["error"]
        if event["type"] == "reply":
            expect_audio = want_audio
        elif event["type"] == "audio":
            got_audio = True
        elif event["type"] == "done":
            done = True
        yield event
