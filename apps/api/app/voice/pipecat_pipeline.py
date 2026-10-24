
"""Tkallem — Pipecat WebRTC voice pipeline."""

import asyncio
import io
import logging
import struct
import uuid
import wave
from collections import deque
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
from app.config import settings
from app.db.connection import ConnFactory
from app.db.sessions import save_turn
from app.voice.stt import transcribe
from app.voice.tts import Speech, synthesize, TtsError

logger = logging.getLogger(__name__)


# ============================================================
# AUDIO UTILITIES
# ============================================================

def audio_bytes_to_pcm16(
    audio_bytes: bytes,
    target_sr: int = 16000,
) -> bytes:
    """Convert WAV audio to mono signed PCM16."""

    if not audio_bytes:
        return b""

    try:
        with wave.open(io.BytesIO(audio_bytes), "rb") as wf:
            channels = wf.getnchannels()
            width = wf.getsampwidth()
            source_sr = wf.getframerate()
            raw = wf.readframes(wf.getnframes())

        if width == 1:
            samples = [
                (value - 128) << 8
                for value in raw
            ]
        elif width == 2:
            samples = list(
                struct.unpack(
                    f"<{len(raw) // 2}h",
                    raw,
                )
            )
        elif width == 4:
            values = struct.unpack(
                f"<{len(raw) // 4}i",
                raw,
            )
            samples = [value >> 16 for value in values]
        else:
            raise ValueError(
                f"Unsupported WAV sample width: {width}"
            )

        if channels > 1:
            samples = [
                sum(samples[i:i + channels]) // channels
                for i in range(0, len(samples), channels)
            ]

        if source_sr != target_sr and samples:
            ratio = source_sr / target_sr
            count = int(len(samples) / ratio)

            samples = [
                samples[min(
                    int(i * ratio),
                    len(samples) - 1,
                )]
                for i in range(count)
            ]

        if not samples:
            return b""

        return struct.pack(
            f"<{len(samples)}h",
            *samples,
        )

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
            result = await asyncio.to_thread(
                transcribe,
                audio,
                "turn.wav",
                "audio/wav",
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
        self._pending_transcriptions = deque()
        self._background_tasks = set()
        self._is_speaking = False

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

            speech: Speech = await asyncio.to_thread(
                synthesize,
                text,
            )

            audio = (
                getattr(speech, "audio", None)
                or getattr(speech, "audio_bytes", None)
            )

            if not audio:
                raise RuntimeError(
                    "TTS returned no audio"
                )

            pcm = audio_bytes_to_pcm16(
                audio,
                target_sr=16000,
            )

            if not pcm:
                raise RuntimeError(
                    "TTS audio could not be decoded"
                )

            chunk_size = 640

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
                        sample_rate=16000,
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
            # Existing LangGraph / CoachSession logic.
            def get_events():
                return list(
                    self.coach.turn_events(text)
                )

            events = await asyncio.to_thread(
                get_events
            )

            for event in events:
                event_type = event.get("type")

                if event_type == "reply":
                    reply_text = event.get(
                        "reply",
                        "",
                    )

                elif event_type == "corrections":
                    corrections = event.get(
                        "corrections",
                        [],
                    )
                    sentence_status = event.get(
                        "sentence_status",
                        "green",
                    )

                elif event_type == "done":
                    turn = event.get("turn")

                    if turn:
                        goal_covered = (
                            turn.goal_covered
                        )

            if not reply_text:
                reply_text = (
                    "I see. Let's continue."
                )

            logger.info(
                "LLM response: %s",
                reply_text,
            )

            # Send text to the frontend immediately.
            await self.send_event({
                "type": "bot_transcript",
                "text": reply_text,
                "utterance_id": utterance_id,
            })

            # Start audio generation automatically.
            self.start_speaking(reply_text)

            # Persist before processing another queued answer against the same session.
            await self.save_correction(
                utterance_id, text, reply_text, corrections,
                sentence_status, goal_covered, expected_turns,
            )

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
                self.queue_transcription(text)

            return

        # Forward ALL other frames, including
        # control, audio and system frames.
        await self.push_frame(
            frame,
            direction,
        )

    def queue_transcription(self, text: str):
        """Keep later speech while the preceding answer is being corrected and saved."""
        self._pending_transcriptions.append(text)
        if self._current_turn_task and not self._current_turn_task.done():
            return
        self._current_turn_task = asyncio.create_task(self._drain_transcriptions())
        self._track_task(self._current_turn_task)

    async def _drain_transcriptions(self):
        while self._pending_transcriptions:
            await self.handle_transcription(self._pending_transcriptions.popleft())

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
            stop_secs=settings.voice_turn_silence_secs,
            start_secs=0.2,
        )
    )

    transport = SmallWebRTCTransport(
        webrtc_connection=webrtc_connection,
        params=TransportParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            audio_in_sample_rate=16000,
            audio_out_sample_rate=16000,
        ),
    )

    rtvi = RTVIProcessor()

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
