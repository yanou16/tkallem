"""Echo gate: the coach's own voice coming back through the microphone must never reach the voice detector."""
import asyncio

import pytest
from pipecat.frames.frames import BotStartedSpeakingFrame, BotStoppedSpeakingFrame, InputAudioRawFrame
from pipecat.processors.frame_processor import FrameDirection

from pipecat.tests.utils import run_test

from app.voice.echo_gate import EchoGate


class Clock:
    def __init__(self):
        self.now = 100.0

    def __call__(self):
        return self.now


def chunk():
    return InputAudioRawFrame(audio=b"\x10\x20" * 160, sample_rate=16000, num_channels=1)


@pytest.fixture
def clock():
    return Clock()


@pytest.fixture
def gate(clock):
    return EchoGate(hold_secs=0.6, clock=clock)


def audio_out(down):
    return [f.audio for f in down if isinstance(f, InputAudioRawFrame)]


def test_the_student_is_heard_while_the_coach_is_silent(gate):
    assert gate.closed() is False


def test_the_line_is_deaf_while_the_coach_talks_and_a_moment_after(gate, clock):
    gate._bot_speaking_since = clock()
    assert gate.closed() is True
    gate._bot_speaking_since = None
    gate._open_again_at = clock() + 0.6
    assert gate.closed() is True
    clock.now += 0.61
    assert gate.closed() is False


def test_a_lost_stop_frame_does_not_leave_the_student_unheard(gate, clock):
    gate._bot_speaking_since = clock()
    clock.now += 61
    assert gate.closed() is False


def test_the_gate_can_be_switched_off(clock):
    gate = EchoGate(enabled=False, clock=clock)
    gate._bot_speaking_since = clock()
    assert gate.closed() is False


def test_what_the_microphone_hears_while_the_coach_talks_is_replaced_by_silence(clock):
    asyncio.run(_silence_while_the_coach_talks(clock))


async def _silence_while_the_coach_talks(clock):
    gate = EchoGate(hold_secs=0.6, clock=clock)
    heard, loud = chunk(), chunk()
    down, _ = await run_test(
        gate,
        frames_to_send=[heard, BotStartedSpeakingFrame(), loud],
        expected_down_frames=[InputAudioRawFrame, BotStartedSpeakingFrame, InputAudioRawFrame],
    )
    audio = audio_out(down)
    assert audio[0] == b"\x10\x20" * 160  # before the coach speaks: untouched
    assert audio[1] == bytes(320)  # while it speaks: silence of the same length (the detector's timing is kept)


def test_the_student_is_heard_again_after_the_coach_and_its_tail(clock):
    asyncio.run(_heard_again_after_the_tail(clock))


async def _heard_again_after_the_tail(clock):
    gate = EchoGate(hold_secs=0.6, clock=clock)
    tail, later = chunk(), chunk()

    async def run(frames_after_stop):
        return await run_test(gate, frames_to_send=[BotStartedSpeakingFrame(), BotStoppedSpeakingFrame(), *frames_after_stop],
                              expected_down_frames=None)

    down, _ = await run([tail])
    assert audio_out(down) == [bytes(320)]  # right after it stopped, its last words may still be in the air
    clock.now += 0.7
    down, _ = await run_test(gate, frames_to_send=[later], expected_down_frames=[InputAudioRawFrame])
    assert audio_out(down) == [b"\x10\x20" * 160]
