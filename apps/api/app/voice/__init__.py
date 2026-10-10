"""Voice pipeline: speech-to-text and text-to-speech, provider chosen by configuration (see stt.py, tts.py)."""
from .stt import SttError, Transcription, transcribe
from .tts import Speech, TtsError, synthesize

__all__ = ["Speech", "SttError", "Transcription", "TtsError", "synthesize", "transcribe"]
