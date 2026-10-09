import logging
from io import BytesIO
from fastapi import HTTPException, UploadFile, status
from groq import Groq
from app.config import settings

logger = logging.getLogger(__name__)


async def transcribe_audio(audio: UploadFile) -> str:
    """Transcribe user audio to text via Groq Whisper."""
    if not settings.groq_api_key:
        logger.error("GROQ_API_KEY is not set: cannot transcribe audio")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Voice transcription service is not configured (missing GROQ_API_KEY).",
        )

    content = await audio.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Empty audio file")

    if len(content) > settings.max_audio_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Audio file exceeds maximum size ({settings.max_audio_bytes} bytes)",
        )

    filename = audio.filename or "recording.webm"
    try:
        client = Groq(api_key=settings.groq_api_key)
        transcription = client.audio.transcriptions.create(
            file=(filename, content),
            model=settings.stt_model,
        )
        return transcription.text.strip()
    except Exception as exc:
        logger.exception("Groq audio transcription failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to transcribe audio from speech provider.",
        )
