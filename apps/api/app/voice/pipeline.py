"""One voice turn: the agent answers, and the coach's voice is started as soon as its reply is known, while the
corrections are still being computed (the reply event comes first, see CoachSession.turn_events)."""
import logging
from collections.abc import Callable
from concurrent.futures import Future, ThreadPoolExecutor
from dataclasses import dataclass, field

from tkallem_agent import CoachSession
from tkallem_agent.schemas import AgentTurn

from app.voice.tts import Speech, TtsError, synthesize

logger = logging.getLogger(__name__)
_POOL = ThreadPoolExecutor(max_workers=8, thread_name_prefix="tkallem-tts")


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
