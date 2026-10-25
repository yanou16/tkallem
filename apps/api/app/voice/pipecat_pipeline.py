
"""Tkallem — Pipecat WebRTC voice pipeline."""

import asyncio
import audioop
import io
import logging
import struct
import time
import uuid
import wave
from datetime import datetime, timezone
from typing import AsyncGenerator
from uuid import UUID

from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.audio.vad.vad_analyzer import VADParams
from pipecat.frames.frames import (
    BotStartedSpeakingFrame,
    BotStoppedSpeakingFrame,
    CancelFrame,
    EndFrame,
    Frame,
    InterruptionFrame,
    StartFrame,
    TranscriptionFrame,
    TTSAudioRawFrame,
    TTSStartedFrame,
    TTSStoppedFrame,
    UserStartedSpeakingFrame,
    UserStoppedSpeakingFrame,
    VADUserStartedSpeakingFrame,
    VADUserStoppedSpeakingFrame,
)
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.audio.vad_processor import VADProcessor
from pipecat.processors.frame_processor import (
    FrameDirection,
    FrameProcessor,
)
from pipecat.processors.frameworks.rtvi import (
    RTVIProcessor,
    RTVIObserver,
)
from pipecat.services.settings import STTSettings
from pipecat.services.stt_service import SegmentedSTTService
from pipecat.transports.base_transport import TransportParams
from pipecat.transports.smallwebrtc.connection import (
    SmallWebRTCConnection,
)
from pipecat.transports.smallwebrtc.transport import (
    SmallWebRTCTransport,
)

from tkallem_agent import CoachSession

from app import credits
from app.voice import smallwebrtc_patch  # noqa: F401
from app.voice.echo_gate import EchoGate
from app.config import settings
from app.db.connection import ConnFactory
from app.db.sessions import save_turn
from app.voice.stt import transcribe
from app.voice.tts import Speech, synthesize, TtsError

logger = logging.getLogger(__name__)


# ============================================================
# AUDIO UTILITIES
# ============================================================

OUT_SAMPLE_RATE = 24000  # what the voices make (Orpheus and Kokoro): sent as it is, nothing is resampled on the usual path
OUT_CHUNK_BYTES = OUT_SAMPLE_RATE * 2 // 50  # 20 ms of 16-bit mono


def audio_bytes_to_pcm16(
    audio_bytes: bytes,
    target_sr: int = OUT_SAMPLE_RATE,
) -> bytes:
    """Convert WAV audio to mono signed PCM16 at target_sr.

    The conversion is audioop's (filtered, in C). It used to keep one sample out of three to go from 24 kHz to 16 kHz,
    which folds high frequencies back into the voice: the call sounded metallic, much worse than the voice message.
    """

    if not audio_bytes:
        return b""

    try:
        with wave.open(io.BytesIO(audio_bytes), "rb") as wf:
            channels = wf.getnchannels()
            width = wf.getsampwidth()
            source_sr = wf.getframerate()
            raw = wf.readframes(wf.getnframes())

        if width == 1:
            raw = audioop.bias(raw, 1, -128)  # 8-bit WAV is unsigned
        if width != 2:
            raw = audioop.lin2lin(raw, width, 2)
        if channels == 2:
            raw = audioop.tomono(raw, 2, 0.5, 0.5)
        elif channels != 1:
            raise ValueError(f"Unsupported channel count: {channels}")
        if source_sr != target_sr and raw:
            raw, _ = audioop.ratecv(raw, 2, 1, source_sr, target_sr, None)

        return raw

    except Exception:
        logger.exception("Failed to decode TTS audio")
        return b""


# ============================================================
# SPEECH TO TEXT
# ============================================================

class TkallemSTTService(SegmentedSTTService):
    """Reuse existing Tkallem STT provider."""

    def __init__(self, **kwargs):
        super().__init__(
            sample_rate=16000,
            trailing_silence_secs=0.4,
            settings=STTSettings(
                model=settings.stt_model,
                language="en",
            ),
            **kwargs,
        )

    async def cleanup(self):
        await self._cancel_segment_task()
        await super().cleanup()

    async def run_stt(
        self,
        audio: bytes,
    ) -> AsyncGenerator[Frame, None]:

        if not audio or len(audio) < 1600:
            return

        try:
            stt_started = time.monotonic()
            result = await asyncio.to_thread(
                transcribe,
                audio,
                "turn.wav",
                "audio/wav",
            )
            logger.warning(
                "call stt: %s in %.1f s (%.1f s of speech)",
                getattr(result, "provider", "?"),
                time.monotonic() - stt_started,
                len(audio) / 32000,
            )

            if not result or not result.text:
                logger.warning("Empty STT transcription")
                return

            if result.unclear:
                logger.warning("Unclear STT transcription")
                return

            text = result.text.strip()

            logger.info("STT transcription: %s", text)

            yield TranscriptionFrame(
                text=text,
                user_id="student",
                timestamp=datetime.now(
                    timezone.utc
                ).isoformat(),
            )

        except Exception:
            logger.exception("STT transcription failed")


# ============================================================
# VOICE CONVERSATION PROCESSOR
# ============================================================

class _VoiceSkipped(TtsError):
    """The server voice was not even tried: it failed repeatedly a moment ago."""


class TkallemVoiceTurnProcessor(FrameProcessor):

    def __init__(
        self,
        *,
        session_id: UUID,
        user: dict,
        coach: CoachSession,
        connect: ConnFactory,
        rtvi: RTVIProcessor,
        **kwargs,
    ):
        super().__init__(**kwargs)

        self.session_id = session_id
        self.user = user
        self.coach = coach
        self.connect = connect
        self.rtvi = rtvi

        self._current_speech_task = None
        self._current_turn_task = None
        self._background_tasks = set()
        self._is_speaking = False
        self._tts_failures = 0  # server voice failures in a row (call only)
        self._tts_skip_until = 0.0  # monotonic time until which the browser's voice is used straight away

    def _track_task(self, task):
        self._background_tasks.add(task)
        task.add_done_callback(
            self._background_tasks.discard
        )
        return task

    async def send_event(self, payload: dict):
        try:
            await self.rtvi.send_server_message(payload)
        except Exception:
            logger.exception(
                "Failed to send RTVI server message"
            )

    # --------------------------------------------------------
    # TEXT TO SPEECH
    # --------------------------------------------------------

    async def speak_text(self, text: str):
        """Speak a response through WebRTC output."""

        if not text:
            return

        self._is_speaking = True

        try:
            await self.push_frame(
                TTSStartedFrame()
            )
            await self.push_frame(
                BotStartedSpeakingFrame()
            )

            logger.info("TTS started: %s", text)

            if time.monotonic() < self._tts_skip_until:
                raise _VoiceSkipped("server voice skipped after repeated failures")

            # A call cannot wait for a slow voice: the reply text is already on the student's screen, and past this wait
            # the browser reads it (a late audio is dropped). The thread keeps running, its result is discarded.
            try:
                speech: Speech = await asyncio.wait_for(
                    asyncio.to_thread(synthesize, text),
                    timeout=settings.voice_call_tts_wait_secs,
                )
            except asyncio.TimeoutError:
                # The usual voices are slow or blocked: the voice that runs here says the line (a second at most),
                # before the page falls back on the browser's voice. Raises TtsError when it is not set up.
                speech = await asyncio.wait_for(
                    asyncio.to_thread(synthesize, text, provider="piper"),
                    timeout=settings.voice_call_safety_net_wait_secs,
                )
            self._tts_failures = 0
            logger.warning("call voice: %s in %.1f s (%d characters)", speech.provider, speech.latency_s, len(text))

            audio = (
                getattr(speech, "audio", None)
                or getattr(speech, "audio_bytes", None)
            )

            if not audio:
                raise RuntimeError(
                    "TTS returned no audio"
                )

            pcm = audio_bytes_to_pcm16(audio)

            if not pcm:
                raise RuntimeError(
                    "TTS audio could not be decoded"
                )

            chunk_size = OUT_CHUNK_BYTES

            for index in range(0, len(pcm), chunk_size):
                if not self._is_speaking:
                    break

                chunk = pcm[
                    index:index + chunk_size
                ]

                if len(chunk) < chunk_size:
                    chunk = chunk.ljust(
                        chunk_size,
                        b"\x00",
                    )

                await self.push_frame(
                    TTSAudioRawFrame(
                        audio=chunk,
                        sample_rate=OUT_SAMPLE_RATE,
                        num_channels=1,
                    )
                )

                await asyncio.sleep(0)

            logger.info("TTS audio queued successfully")

        except asyncio.CancelledError:
            logger.info("Speech interrupted")
            raise

        except (TtsError, Exception) as exc:
            logger.exception("TTS failed")
            if not isinstance(exc, _VoiceSkipped):  # a skipped attempt is not a new failure: it must not extend the pause
                self._tts_failures += 1
                if self._tts_failures >= settings.voice_call_tts_failures_to_skip:
                    self._tts_skip_until = time.monotonic() + settings.voice_call_tts_skip_secs

            await self.send_event({
                "type": "error",
                "code": "tts_error",
                "detail": str(exc),
            })

        finally:
            self._is_speaking = False

            await self.push_frame(
                TTSStoppedFrame()
            )
            await self.push_frame(
                BotStoppedSpeakingFrame()
            )

    def interrupt_speech(self):
        """Cancel current speech generation."""

        self._is_speaking = False

        task = self._current_speech_task

        if task and not task.done():
            task.cancel()

        self._current_speech_task = None

    def start_speaking(self, text: str):
        self.interrupt_speech()

        task = asyncio.create_task(
            self.speak_text(text)
        )

        self._current_speech_task = task
        self._track_task(task)

    # --------------------------------------------------------
    # PERSISTENCE / CORRECTIONS
    # --------------------------------------------------------

    async def save_correction(
        self,
        utterance_id: str,
        student_text: str,
        reply: str,
        corrections: list,
        sentence_status: str,
        goal_covered,
        expected_turns: int,
    ):
        try:
            with self.connect() as conn:
                save_turn(
                    conn,
                    self.session_id,
                    self.coach.to_state(),
                    student_text,
                    reply,
                    sentence_status,
                    goal_covered,
                    corrections,
                    expected_turns=expected_turns,
                )

            await self.send_event({
                "type": "correction",
                "utterance_id": utterance_id,
                "original": student_text,
                "reply": reply,
                "corrections": corrections,
                "sentence_status": sentence_status,
                "level": self.coach.level,
                "explain_lang": self.coach.explain_lang,
                "timestamp": datetime.now(
                    timezone.utc
                ).isoformat(),
            })

        except Exception:
            logger.exception(
                "Failed to save voice turn"
            )

    # --------------------------------------------------------
    # CONVERSATION
    # --------------------------------------------------------

    async def handle_transcription(self, text: str):
        """Generate one conversation turn."""

        logger.info(
            "Processing user transcription: %s",
            text,
        )

        await self.send_event({
            "type": "user_transcript",
            "text": text,
        })

        try:
            with self.connect() as conn:
                credits.spend(
                    conn,
                    self.user,
                    self.session_id,
                )

        except credits.NoCredits:
            await self.send_event({
                "type": "error",
                "code": "no_credits",
                "detail": "You are out of credits.",
            })
            return

        except credits.DailyBudgetReached:
            await self.send_event({
                "type": "error",
                "code": "daily_budget_reached",
                "detail": "Daily practice budget reached.",
            })
            return

        utterance_id = uuid.uuid4().hex
        expected_turns = len(self.coach.turns)

        reply_text = ""
        corrections = []
        sentence_status = "green"
        goal_covered = None

        try:
            # Existing LangGraph / CoachSession logic, read as a stream: the reply is sent and spoken as soon as it
            # exists, while the corrections are still being made (the turn used to be read to the end first, which
            # added the whole corrector call to the wait: 10 to 25 s on production).
            loop = asyncio.get_running_loop()
            events_queue: asyncio.Queue = asyncio.Queue()
            started = time.monotonic()

            def produce():
                try:
                    for event in self.coach.turn_events(text):
                        loop.call_soon_threadsafe(events_queue.put_nowait, ("event", event))
                except BaseException as exc:  # handed to the loop below, which raises it
                    loop.call_soon_threadsafe(events_queue.put_nowait, ("error", exc))
                else:
                    loop.call_soon_threadsafe(events_queue.put_nowait, ("end", None))

            self._track_task(asyncio.ensure_future(asyncio.to_thread(produce)))
            replied = False

            async def say(reply: str):
                nonlocal replied
                replied = True
                logger.warning("call turn: reply ready in %.1f s", time.monotonic() - started)
                # Send text to the frontend immediately, then start the audio.
                await self.send_event({
                    "type": "bot_transcript",
                    "text": reply,
                    "utterance_id": utterance_id,
                })
                self.start_speaking(reply)

            while True:
                kind, payload = await events_queue.get()
                if kind == "error":
                    raise payload
                if kind == "end":
                    break
                event_type = payload.get("type")

                if event_type == "reply":
                    reply_text = payload.get("reply", "")
                    if reply_text and not replied:
                        await say(reply_text)

                elif event_type == "corrections":
                    corrections = payload.get("corrections", [])
                    sentence_status = payload.get("sentence_status", "green")

                elif event_type == "done":
                    turn = payload.get("turn")

                    if turn:
                        goal_covered = turn.goal_covered

            if not replied:
                reply_text = reply_text or "I see. Let's continue."
                await say(reply_text)

            logger.warning("call turn: corrections done in %.1f s", time.monotonic() - started)
            logger.info(
                "LLM response: %s",
                reply_text,
            )

            # Save conversation separately.
            task = asyncio.create_task(
                self.save_correction(
                    utterance_id,
                    text,
                    reply_text,
                    corrections,
                    sentence_status,
                    goal_covered,
                    expected_turns,
                )
            )
            self._track_task(task)

        except asyncio.CancelledError:
            raise

        except Exception:
            logger.exception(
                "Voice conversation failed"
            )

            try:
                with self.connect() as conn:
                    credits.refund(
                        conn,
                        self.user,
                        self.session_id,
                    )
            except Exception:
                logger.exception(
                    "Credit refund failed"
                )

            await self.send_event({
                "type": "error",
                "code": "conversation_error",
                "detail": (
                    "Coach encountered an error. "
                    "Please speak again."
                ),
            })

    # --------------------------------------------------------
    # FRAME PROCESSING
    # --------------------------------------------------------

    async def process_frame(
        self,
        frame: Frame,
        direction: FrameDirection,
    ):
        await super().process_frame(
            frame,
            direction,
        )

        # Essential: forward lifecycle frames.
        if isinstance(
            frame,
            (StartFrame, EndFrame, CancelFrame),
        ):
            await self.push_frame(
                frame,
                direction,
            )
            return

        if isinstance(
            frame,
            (
                VADUserStartedSpeakingFrame,
                UserStartedSpeakingFrame,
            ),
        ):
            if self._is_speaking:
                self.interrupt_speech()

                await self.push_frame(
                    InterruptionFrame()
                )

            if isinstance(
                frame,
                VADUserStartedSpeakingFrame,
            ):
                await self.push_frame(
                    UserStartedSpeakingFrame()
                )
            else:
                await self.push_frame(
                    frame,
                    direction,
                )

            return

        if isinstance(
            frame,
            VADUserStoppedSpeakingFrame,
        ):
            await self.push_frame(
                UserStoppedSpeakingFrame()
            )
            return

        if isinstance(frame, TranscriptionFrame):
            # Let RTVI observers see this frame.
            await self.push_frame(
                frame,
                direction,
            )

            text = frame.text.strip()

            if text:
                # Do not block frame propagation
                # with a slow LLM request.
                if (
                    self._current_turn_task
                    and not self._current_turn_task.done()
                ):
                    logger.warning(
                        "Previous turn still processing"
                    )
                    return

                task = asyncio.create_task(
                    self.handle_transcription(text)
                )

                self._current_turn_task = task
                self._track_task(task)

            return

        # Forward ALL other frames, including
        # control, audio and system frames.
        await self.push_frame(
            frame,
            direction,
        )

    async def cleanup(self):
        self.interrupt_speech()

        for task in list(self._background_tasks):
            if not task.done():
                task.cancel()

        if self._background_tasks:
            await asyncio.gather(
                *self._background_tasks,
                return_exceptions=True,
            )

        await super().cleanup()


# ============================================================
# BUILD VOICE PIPELINE
# ============================================================

def build_voice_pipeline(
    webrtc_connection: SmallWebRTCConnection,
    session_id: UUID,
    user: dict,
    coach: CoachSession,
    connect: ConnFactory,
) -> tuple[
    PipelineRunner,
    PipelineTask,
    TkallemVoiceTurnProcessor,
]:
    """Build the Tkallem real-time voice pipeline."""

    vad = SileroVADAnalyzer(
        params=VADParams(
            confidence=0.65,
            min_volume=0.1,
            stop_secs=0.8,
            start_secs=0.2,
        )
    )

    transport = SmallWebRTCTransport(
        webrtc_connection=webrtc_connection,
        params=TransportParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            audio_in_sample_rate=16000,
            audio_out_sample_rate=OUT_SAMPLE_RATE,
        ),
    )

    rtvi = RTVIProcessor()

    echo_gate = EchoGate(enabled=settings.voice_echo_gate, hold_secs=settings.voice_echo_hold_secs)

    vad_processor = VADProcessor(
        vad_analyzer=vad
    )

    stt = TkallemSTTService()

    processor = TkallemVoiceTurnProcessor(
        session_id=session_id,
        user=user,
        coach=coach,
        connect=connect,
        rtvi=rtvi,
    )

    # --------------------------------------------------------
    # GREETING
    # --------------------------------------------------------

    greeted = False

    async def greet(rtvi_proc):
        nonlocal greeted

        if greeted:
            return

        greeted = True

        logger.info(
            "Preparing greeting for session %s",
            session_id,
        )

        try:
            await rtvi_proc.set_bot_ready()

            if not coach.turns and coach.opening:
                greeting_text = coach.opening

            elif coach.turns:
                greeting_text = coach.turns[-1].reply

            else:
                greeting_text = (
                    "Hello! I'm your English tutor. "
                    "How are you today?"
                )

            await processor.send_event({
                "type": "bot_transcript",
                "text": greeting_text,
                "utterance_id": uuid.uuid4().hex,
            })

            processor.start_speaking(
                greeting_text
            )

            logger.info(
                "Greeting started for session %s",
                session_id,
            )

        except Exception:
            greeted = False
            logger.exception(
                "Greeting failed for session %s",
                session_id,
            )

    @rtvi.event_handler("on_client_ready")
    async def on_client_ready(rtvi_proc):
        logger.info(
            "RTVI client ready for session %s",
            session_id,
        )
        await greet(rtvi_proc)

    # --------------------------------------------------------
    # TRANSPORT EVENTS
    # --------------------------------------------------------

    @transport.event_handler("on_client_connected")
    async def on_client_connected(
        transport_obj,
        client_conn,
    ):
        logger.info(
            "WebRTC connected for session %s",
            session_id,
        )

    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(
        transport_obj,
        client_conn,
    ):
        logger.info(
            "WebRTC disconnected for session %s",
            session_id,
        )
        processor.interrupt_speech()

    # --------------------------------------------------------
    # PIPELINE
    # --------------------------------------------------------

    pipeline = Pipeline([
        transport.input(),
        rtvi,
        echo_gate,
        vad_processor,
        stt,
        processor,
        transport.output(),
    ])

    # Explicit observer paired with RTVIProcessor.
    observer = RTVIObserver(rtvi)

    task = PipelineTask(
        pipeline,
        params=PipelineParams(
            allow_interruptions=True,
        ),
        observers=[observer],
        rtvi_processor=rtvi,
    )

    # Use the existing runner convention.
    runner = PipelineRunner()

    logger.info(
        "Voice pipeline constructed for session %s",
        session_id,
    )

    return runner, task, processor
