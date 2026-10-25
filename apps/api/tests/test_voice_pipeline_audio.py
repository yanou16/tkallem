"""The coach's voice on the call: sent as the voice makes it (24 kHz), converted properly when it is not."""
import io
import math
import struct
import wave

from app.voice.pipecat_pipeline import OUT_CHUNK_BYTES, OUT_SAMPLE_RATE, audio_bytes_to_pcm16


def wav(samples, rate=24000, channels=1, width=2):
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(channels)
        w.setsampwidth(width)
        w.setframerate(rate)
        w.writeframes(samples)
    return buf.getvalue()


def tone(freq, rate=24000, secs=0.5, amp=12000):
    return struct.pack(f"<{int(rate * secs)}h", *[int(amp * math.sin(2 * math.pi * freq * i / rate)) for i in range(int(rate * secs))])


def test_a_24k_voice_is_sent_untouched():
    pcm = tone(440)
    assert audio_bytes_to_pcm16(wav(pcm)) == pcm


def test_a_chunk_is_twenty_milliseconds():
    assert OUT_SAMPLE_RATE == 24000 and OUT_CHUNK_BYTES == 960


def test_another_rate_is_converted_to_the_output_rate():
    out = audio_bytes_to_pcm16(wav(tone(440, rate=16000), rate=16000))
    assert abs(len(out) / 2 - 12000) < 50  # 0.5 s at 24 kHz


def test_stereo_and_8_bit_files_become_mono_16_bit():
    left_right = struct.pack("<4h", 1000, 3000, -1000, -3000)
    assert audio_bytes_to_pcm16(wav(left_right, channels=2)) == struct.pack("<2h", 2000, -2000)
    eight = audio_bytes_to_pcm16(wav(bytes([128, 192, 64]), width=1))
    assert struct.unpack("<3h", eight)[0] == 0 and len(eight) == 6


def test_unreadable_audio_gives_nothing_instead_of_noise():
    assert audio_bytes_to_pcm16(b"") == b""
    assert audio_bytes_to_pcm16(b"not a wav") == b""
