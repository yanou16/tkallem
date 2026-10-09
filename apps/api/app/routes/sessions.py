import logging
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from psycopg import Connection
from tkallem_agent import AgentError, CoachSession, ScenarioNotFound

from app.config import settings
from app.db.connection import get_conn
from app.db.sessions import (
    create_practice_session,
    end_practice_session,
    get_practice_session,
    save_turn,
    update_practice_session_state,
)
from app.dependencies import get_current_user
from app.schemas.sessions import (
    EndSessionReport,
    StartSessionRequest,
    StartSessionResponse,
    TurnResponse,
)
from app.voice.stt import transcribe_audio

router = APIRouter(prefix="/sessions", tags=["sessions"])
logger = logging.getLogger(__name__)


@router.post("", response_model=StartSessionResponse)
def start_session(
    body: StartSessionRequest,
    user: dict = Depends(get_current_user),
    conn: Connection | None = Depends(get_conn),
) -> dict:
    level = user.get("level") or "B1"
    explain_lang = body.explain_lang.value if body.explain_lang else (user.get("explain_lang") or "fr")

    try:
        session = CoachSession(
            body.scenario_id,
            level=level,
            explain_lang=explain_lang,
            max_text_chars=settings.max_text_chars,
        )
    except ScenarioNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Scenario {body.scenario_id!r} not found")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))

    create_practice_session(
        conn,
        session.session_id,
        user["id"],
        body.scenario_id,
        body.mode.value,
        explain_lang,
        session.to_state(),
    )

    return {
        "session_id": session.session_id,
        "first_question": {
            "text": session.opening,
            "audio_url": None,
        },
    }


@router.post("/{session_id}/turn", response_model=TurnResponse)
async def submit_turn(
    session_id: str,
    text: str | None = Form(None),
    audio: UploadFile | None = File(None),
    user: dict = Depends(get_current_user),
    conn: Connection | None = Depends(get_conn),
) -> dict:
    session_row = get_practice_session(conn, session_id, user["id"])
    if not session_row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    student_text = text
    if audio is not None:
        student_text = await transcribe_audio(audio)

    if not student_text or not student_text.strip():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="No message or audio provided")

    try:
        session = CoachSession.from_state(
            session_row["state"],
            max_text_chars=settings.max_text_chars,
        )
        turn = await session.aturn(student_text.strip())
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    except AgentError as exc:
        logger.exception("AI agent turn failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The AI coach could not process this answer. Please repeat your message.",
        )

    corrections_data = [c.model_dump() for c in turn.corrections]
    update_practice_session_state(conn, session_id, session.to_state())
    save_turn(
        conn,
        session_id,
        len(session.turns) - 1,
        student_text.strip(),
        turn.reply,
        turn.sentence_status,
        turn.goal_covered,
        corrections_data,
    )

    return {
        "transcript": student_text.strip(),
        "reply": turn.reply,
        "reply_audio_url": None,
        "corrections": corrections_data,
        "sentence_status": turn.sentence_status,
    }


@router.post("/{session_id}/end", response_model=EndSessionReport)
async def end_session(
    session_id: str,
    user: dict = Depends(get_current_user),
    conn: Connection | None = Depends(get_conn),
) -> dict:
    session_row = get_practice_session(conn, session_id, user["id"])
    if not session_row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    try:
        session = CoachSession.from_state(
            session_row["state"],
            max_text_chars=settings.max_text_chars,
        )
        report = await session.aend()
    except Exception as exc:
        logger.exception("Failed to end session: %s", exc)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to end session")

    metrics_dict = (
        report.metrics.model_dump()
        if hasattr(report.metrics, "model_dump")
        else dict(report.metrics)
    )
    end_practice_session(conn, session_id, report.note, metrics_dict)

    return report.model_dump()
