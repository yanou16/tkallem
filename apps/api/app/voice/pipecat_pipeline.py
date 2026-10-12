"""Pipecat WebRTC Voice Pipeline for Tkallem.

Integrates SmallWebRTC, Silero VAD, STT (Groq/Whisper), RTVI events,
LangGraph CoachSession conversation branch (streaming TTS without delay),
and asynchronous non-blocking Qwen instruction correction branch.
"""
import asyncio
import io
import logging
import struct
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
    Frame,
    InterruptionFrame,
    TextFrame,
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
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor
from pipecat.processors.frameworks.rtvi import RTVIProcessor
from pipecat.services.settings import STTSettings
from pipecat.services.stt_service import SegmentedSTTService
from pipecat.transports.base_transport import TransportParams
from pipecat.transports.smallwebrtc.connection import SmallWebRTCConnection
from pipecat.transports.smallwebrtc.transport import SmallWebRTCTransport
from tkallem_agent import CoachSession

from app import credits
from app.voice import smallwebrtc_patch  # noqa: F401 - apply SmallWebRTC fix
from app.config import settings
from app.db.connection import ConnFactory
from app.db.sessions import get_session_for_user, save_turn
from app.voice.stt import transcribe
from app.voice.tts import Speech, synthesize

logger = logging.getLogger(__name__)


def audio_bytes_to_pcm16(audio_bytes: bytes, target_sr: int = 16000) -> bytes:
    """Extract mono 16-bit PCM at target_sr from WAV bytes produced by synthesize().

    synthesize() returns WAV audio (audio/wav). We use stdlib `wave` to read it
    and resample only if the sample rate differs. This avoids heavy dependencies
    like PyAV or soundfile that may not be installed in all environments.
    """
    if not audio_bytes:
        return b""
    try:
        with wave.open(io.BytesIO(audio_bytes), "rb") as wf:
            channels = wf.getnchannels()
            sampwidth = wf.getsampwidth()  # bytes per sample
            framerate = wf.getframerate()
            raw = wf.readframes(wf.getnframes())

        # Convert to 16-bit if needed (most TTS providers return 16-bit already)
        if sampwidth == 1:
            # 8-bit unsigned → 16-bit signed
            raw = struct.pack(f"{len(raw)}h", *[b * 256 - 32768 for b in raw])
        elif sampwidth == 4:
            # 32-bit → 16-bit (drop lower 2 bytes)
            samples = struct.unpack(f"{len(raw) // 4}i", raw)
            raw = struct.pack(f"{len(samples)}h", *[s >> 16 for s in samples])
        # sampwidth == 2: already 16-bit, nothing to do

        # Mix down to mono if stereo
        if channels > 1:
            samples = struct.unpack(f"{len(raw) // 2}h", raw)
            mono = [sum(samples[i:i + channels]) // channels for i in range(0, len(samples), channels)]
            raw = struct.pack(f"{len(mono)}h", *mono)

        # Simple nearest-neighbor resample when sample rate differs
        if framerate != target_sr:
            src_samples = struct.unpack(f"{len(raw) // 2}h", raw)
            ratio = framerate / target_sr
            dst_len = int(len(src_samples) / ratio)
            resampled = [src_samples[min(int(i * ratio), len(src_samples) - 1)] for i in range(dst_len)]
            raw = struct.pack(f"{len(resampled)}h", *resampled)

        return raw
    except Exception as exc:
        logger.warning("Failed to decode TTS audio to PCM: %s", exc)
        return b""


class TkallemSTTService(SegmentedSTTService):
    """Segmented STT service leveraging the existing Tkallem transcribe() function."""

    def __init__(self, **kwargs):
        super().__init__(
            sample_rate=16000,
            trailing_silence_secs=0.4,
            settings=STTSettings(model=settings.stt_model, language="en"),
            **kwargs,
        )

    async def cleanup(self):
        """Stop the segment worker even when the transport closes abruptly."""
        await self._cancel_segment_task()
        await super().cleanup()

    async def run_stt(self, audio: bytes) -> AsyncGenerator[Frame, None]:
        if not audio or len(audio) < 1600:
            return
        try:
            # SegmentedSTTService already provides a WAV container by default.
            transcription = await asyncio.to_thread(transcribe, audio, "turn.wav", "audio/wav")
            if not transcription or not transcription.text:
                logger.warning("TkallemSTTService returned an empty transcription")
                return
            if transcription.unclear:
                logger.warning("TkallemSTTService rejected an unclear transcription")
                return
            yield TranscriptionFrame(
                text=transcription.text.strip(),
                user_id=getattr(self, "_user_id", "") or "student",
                timestamp=datetime.now(timezone.utc).isoformat(),
            )
        except Exception:
            logger.exception("TkallemSTTService transcription error")


class TkallemVoiceTurnProcessor(FrameProcessor):
    """Handles conversation turns, interruptions, asynchronous corrections, and audio streaming."""

    def __init__(
        self,
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
        self._current_speech_task: asyncio.Task | None = None
        self._is_speaking = False

    async def speak_text(self, text: str):
        """Synthesizes text and streams 20ms PCM audio frames downstream."""
        if not text:
            return
        try:
            self._is_speaking = True
            await self.push_frame(BotStartedSpeakingFrame())
            await self.push_frame(TTSStartedFrame())
            speech: Speech = await asyncio.to_thread(synthesize, text)
            audio_bytes = getattr(speech, "audio", None) or getattr(speech, "audio_bytes", None)
            if not speech or not audio_bytes:
                await self.push_frame(TTSStoppedFrame())
                await self.push_frame(BotStoppedSpeakingFrame())
                self._is_speaking = False
                return

            pcm = audio_bytes_to_pcm16(audio_bytes, target_sr=16000)
            chunk_size = 640  # 20ms of 16kHz 16-bit mono PCM (16000 * 2 * 0.02)
            for i in range(0, len(pcm), chunk_size):
                if not self._is_speaking:
                    break
                chunk = pcm[i : i + chunk_size]
                if len(chunk) < chunk_size:
                    chunk = chunk.ljust(chunk_size, b"\x00")
                await self.push_frame(
                    TTSAudioRawFrame(
                        audio=chunk,
                        sample_rate=16000,
                        num_channels=1,
                    )
                )
                # No sleep here — SmallWebRTC transport applies natural backpressure.
                # An artificial asyncio.sleep(0.018) would add 4-5 s of latency
                # for a typical 5-second reply (250 chunks × 18 ms = 4.5 s).
                await asyncio.sleep(0)
        except asyncio.CancelledError:
            logger.info("Speech playback cancelled (barge-in)")
        except Exception as exc:
            logger.error("Error during speech synthesis or streaming: %s", exc)
            try:
                await self.rtvi.send_server_message(
                    {"type": "error", "code": "tts_error", "detail": f"Text-to-speech error: {exc}"}
                )
            except Exception:
                pass
        finally:
            self._is_speaking = False
            await self.push_frame(TTSStoppedFrame())
            await self.push_frame(BotStoppedSpeakingFrame())

    def interrupt_speech(self):
        """Cancels current speech streaming upon user barge-in."""
        if self._current_speech_task and not self._current_speech_task.done():
            self._current_speech_task.cancel()
            self._current_speech_task = None
        self._is_speaking = False

    async def _handle_async_correction(
        self,
        utterance_id: str,
        student_text: str,
        reply: str,
        corrections: list[dict],
        sentence_status: str,
        goal_covered: str | None,
        expected_turns: int,
    ):
        """Asynchronous branch: saves turn in DB and notifies RTVI client with structured corrections."""
        try:
            # 1. Save in PostgreSQL
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

            # 2. Push structured correction event via RTVI
            correction_payload = {
                "type": "correction",
                "utterance_id": utterance_id,
                "original": student_text,
                "reply": reply,
                "corrections": corrections,
                "sentence_status": sentence_status,
                "level": self.coach.level,
                "explain_lang": self.coach.explain_lang,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
            await self.rtvi.send_server_message(correction_payload)
        except Exception as exc:
            logger.exception("Failed in async correction branch: %s", exc)

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)

        # Handle user barge-in / interruption
        if isinstance(frame, (VADUserStartedSpeakingFrame, UserStartedSpeakingFrame)):
            if self._is_speaking:
                self.interrupt_speech()
                await self.push_frame(InterruptionFrame())
            if isinstance(frame, VADUserStartedSpeakingFrame):
                await self.push_frame(UserStartedSpeakingFrame())

        elif isinstance(frame, VADUserStoppedSpeakingFrame):
            await self.push_frame(UserStoppedSpeakingFrame())

        # Handle finalized speech-to-text
        elif isinstance(frame, TranscriptionFrame):
            text = frame.text.strip()
            if not text:
                return

            await self.rtvi.send_server_message(
                {"type": "user_transcript", "text": text}
            )

            # Check credits before generating turn
            try:
                with self.connect() as conn:
                    credits.spend(conn, self.user, self.session_id)
            except credits.NoCredits:
                await self.rtvi.send_server_message(
                    {"type": "error", "code": "no_credits", "detail": "You are out of credits."}
                )
                return
            except credits.DailyBudgetReached:
                await self.rtvi.send_server_message(
                    {"type": "error", "code": "daily_budget_reached", "detail": "Daily practice budget reached."}
                )
                return

            utterance_id = uuid.uuid4().hex
            expected_turns = len(self.coach.turns)

            # A. Conversation branch: generate coach reply and stream TTS immediately
            reply_text = ""
            corrections = []
            sentence_status = "green"
            goal_covered = None

            try:
                # Use CoachSession.turn_events to get the reply event early
                def get_events():
                    return list(self.coach.turn_events(text))

                events = await asyncio.to_thread(get_events)
                for ev in events:
                    if ev["type"] == "reply":
                        reply_text = ev["reply"]
                    elif ev["type"] == "corrections":
                        corrections = ev.get("corrections", [])
                        sentence_status = ev.get("sentence_status", "green")
                    elif ev["type"] == "done":
                        turn = ev.get("turn")
                        if turn:
                            goal_covered = turn.goal_covered

                if not reply_text:
                    reply_text = "I see. Let's continue."

                # Send bot transcript via RTVI
                await self.rtvi.send_server_message(
                    {"type": "bot_transcript", "text": reply_text, "utterance_id": utterance_id}
                )

                # Play speech
                self.interrupt_speech()
                self._current_speech_task = asyncio.create_task(self.speak_text(reply_text))

                # B. Correction branch (asynchronous, non-blocking)
                asyncio.create_task(
                    self._handle_async_correction(
                        utterance_id,
                        text,
                        reply_text,
                        corrections,
                        sentence_status,
                        goal_covered,
                        expected_turns,
                    )
                )

            except Exception as exc:
                logger.exception("Error processing turn in voice pipeline: %s", exc)
                # Refund credit on failure
                try:
                    with self.connect() as conn:
                        credits.refund(conn, self.user, self.session_id)
                except Exception:
                    pass
                await self.rtvi.send_server_message(
                    {"type": "error", "detail": "Coach encountered an error. Please speak again."}
                )


def build_voice_pipeline(
    webrtc_connection: SmallWebRTCConnection,
    session_id: UUID,
    user: dict,
    coach: CoachSession,
    connect: ConnFactory,
) -> tuple["PipelineRunner", "PipelineTask", "TkallemVoiceTurnProcessor"]:
    """Constructs the full Pipecat pipeline with SmallWebRTC, Silero VAD, STT, and RTVI.

    The Silero VAD analyzer is wrapped in ``VADProcessor`` inline in the pipeline
    so that user speech start and stop events trigger ``SegmentedSTTService`` automatically.
    """
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
            audio_out_enabled=True,
            audio_in_enabled=True,
            audio_in_sample_rate=16000,
            audio_out_sample_rate=16000,
        ),
    )

    rtvi = RTVIProcessor()

    vad_processor = VADProcessor(vad_analyzer=vad)
    stt = TkallemSTTService()

    processor = TkallemVoiceTurnProcessor(
        session_id=session_id,
        user=user,
        coach=coach,
        connect=connect,
        rtvi=rtvi,
    )

    greeted = False

    async def greet(rtvi_proc):
        nonlocal greeted
        if greeted:
            return
        greeted = True
        try:
            await rtvi_proc.set_bot_ready()
        except Exception as e:
            logger.debug("set_bot_ready: %s", e)
        if not coach.turns and coach.opening:
            await rtvi_proc.send_server_message(
                {"type": "bot_transcript", "text": coach.opening, "utterance_id": uuid.uuid4().hex}
            )
            asyncio.create_task(processor.speak_text(coach.opening))
        elif coach.turns:
            last_line = coach.turns[-1].reply
            await rtvi_proc.send_server_message(
                {"type": "bot_transcript", "text": last_line, "utterance_id": uuid.uuid4().hex}
            )
            asyncio.create_task(processor.speak_text(last_line))

    @rtvi.event_handler("on_client_ready")
    async def on_client_ready(rtvi_proc):
        logger.info("RTVI client is ready for session %s, sending bot-ready", session_id)
        await greet(rtvi_proc)

    @transport.event_handler("on_client_connected")
    async def on_client_connected(transport_obj, client_conn):
        logger.info("WebRTC client connected for session %s", session_id)
        async def fallback_ready():
            await asyncio.sleep(0.5)
            await greet(rtvi)
        asyncio.create_task(fallback_ready())

    pipeline = Pipeline(
        [
            transport.input(),
            rtvi,
            vad_processor,
            stt,
            processor,
            transport.output(),
        ]
    )

    task = PipelineTask(
        pipeline,
        params=PipelineParams(
            allow_interruptions=True,
        ),
        rtvi_processor=rtvi,
    )

    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
    runner = PipelineRunner(loop=loop)
    return runner, task, processor
