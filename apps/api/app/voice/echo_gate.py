"""Echo gate: the call never listens while the coach is talking.

On a phone the coach's voice comes out of the loudspeaker and goes straight back into the microphone. The browser's
echo cancellation does not always remove it, and without a gate the server takes its own voice for the student: the
voice detector fires 70 ms after the coach starts, the coach cuts itself off, starts again, and the speech recogniser
may even transcribe the coach as the student's answer.

The gate sits in front of the voice detector. While the coach speaks (and for a short tail afterwards, the time the
last words take to leave the loudspeaker) the incoming audio is replaced by silence of the same length, so the detector
and the recogniser see a quiet line and their timing stays intact. The price is that the student cannot cut the coach
off by talking over it: a coaching call has turns, and the student answers when the coach is done.
"""
import logging
import time

from pipecat.frames.frames import (
    BotStartedSpeakingFrame,
    BotStoppedSpeakingFrame,
    CancelFrame,
    EndFrame,
    Frame,
    InputAudioRawFrame,
)
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor

logger = logging.getLogger(__name__)

MAX_CLOSED_SECS = 60.0  # a lost "stopped speaking" frame must never leave the student unheard


class EchoGate(FrameProcessor):
    def __init__(self, *, hold_secs: float = 0.6, enabled: bool = True, clock=time.monotonic, **kwargs):
        super().__init__(**kwargs)
        self._hold_secs = hold_secs
        self._enabled = enabled
        self._clock = clock
        self._bot_speaking_since: float | None = None
        self._open_again_at = 0.0

    def closed(self) -> bool:
        """True while the coach talks, and for `hold_secs` after it stopped."""
        if not self._enabled:
            return False
        now = self._clock()
        if self._bot_speaking_since is not None:
            return now - self._bot_speaking_since < MAX_CLOSED_SECS
        return now < self._open_again_at

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)
        if isinstance(frame, BotStartedSpeakingFrame):
            if self._bot_speaking_since is None:
                logger.debug("Echo gate closed: the coach is speaking")
            self._bot_speaking_since = self._clock()
        elif isinstance(frame, (BotStoppedSpeakingFrame, EndFrame, CancelFrame)):
            if self._bot_speaking_since is not None:
                logger.debug("Echo gate opens in %.1fs: the coach stopped", self._hold_secs)
                self._open_again_at = self._clock() + self._hold_secs
            self._bot_speaking_since = None
        elif isinstance(frame, InputAudioRawFrame) and direction == FrameDirection.DOWNSTREAM and self.closed():
            frame.audio = bytes(len(frame.audio))
        await self.push_frame(frame, direction)
