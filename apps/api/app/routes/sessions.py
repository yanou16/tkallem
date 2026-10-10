import logging
from uuid import UUID

from fastapi import APIRouter, Depends, Form, HTTPException, status
from psycopg import Connection
from tkallem_agent import AgentError, CoachSession, ScenarioNotFound

from app.config import settings
from app.db.connection import ConnFactory, get_conn, get_conn_factory
from app.db.sessions import create_session, end_session, get_session_for_user, save_turn
from app.db.users import get_or_create_by_clerk_id
from app.dependencies import get_current_user
from app.schemas.sessions import SessionCreate, SessionReport, SessionStarted, TurnResult
from app.security import ClerkClaims, get_clerk_claims

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sessions", tags=["sessions"])


def get_llm():
    return None


@router.post("", response_model=SessionStarted)
def start_session(
    body: SessionCreate,
    user: dict = Depends(get_current_user),
    conn: Connection = Depends(get_conn),
) -> dict:
    if user["level"] is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Choose your level first (PATCH /me)")

    explain_lang = body.explain_lang or user["explain_lang"]
    try:
        coach = CoachSession(
            body.scenario_id,
            level=user["level"],
            explain_lang=explain_lang,
            max_text_chars=settings.max_text_chars,
        )
    except ScenarioNotFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown scenario")

    create_session(
        conn,
        UUID(coach.session_id),
        user["id"],
        coach.scenario.id,
        body.mode,
        explain_lang,
        coach.to_state(),
    )
    return {
        "session_id": coach.session_id,
        "first_question": {"text": coach.opening, "audio_url": None},
    }


@router.post("/{session_id}/turn", response_model=TurnResult)
def send_turn(
    session_id: UUID,
    text: str = Form(...),
    claims: ClerkClaims = Depends(get_clerk_claims),
    connect: ConnFactory = Depends(get_conn_factory),
    llm=Depends(get_llm),
) -> dict:
    with connect() as conn:
        user = get_or_create_by_clerk_id(conn, claims.user_id)
        session = get_session_for_user(conn, session_id, user["id"])
    if session is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
    if session["ended_at"] is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Session already ended")

    expected_turns = len(session["state"]["turns"])
    coach = CoachSession.from_state(session["state"], llm=llm, max_text_chars=settings.max_text_chars)
    try:
        turn = coach.turn(text)
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc))
    except AgentError:
        logger.exception("Agent failed on session %s", session_id)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "The coach is unavailable, send your answer again")

    transcript = coach.turns[-1].student_text
    corrections = [c.model_dump() for c in turn.corrections]
    with connect() as conn:
        saved = save_turn(
            conn,
            session_id,
            coach.to_state(),
            transcript,
            turn.reply,
            turn.sentence_status,
            turn.goal_covered,
            corrections,
            expected_turns=expected_turns,
        )
    if saved is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "This session changed meanwhile, reload it")

    return {
        "transcript": transcript,
        "reply": turn.reply,
        "reply_audio_url": None,
        "corrections": corrections,
        "sentence_status": turn.sentence_status,
        "finished": coach.finished,
    }


@router.post("/{session_id}/end", response_model=SessionReport)
def end_practice_session(
    session_id: UUID,
    claims: ClerkClaims = Depends(get_clerk_claims),
    connect: ConnFactory = Depends(get_conn_factory),
    llm=Depends(get_llm),
) -> dict:
    with connect() as conn:
        user = get_or_create_by_clerk_id(conn, claims.user_id)
        session = get_session_for_user(conn, session_id, user["id"])
    if session is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
    if session["ended_at"] is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Session already ended")
    if not session["state"]["turns"]:
        raise HTTPException(status.HTTP_409_CONFLICT, "Answer at least one question before ending the session")

    coach = CoachSession.from_state(session["state"], llm=llm, max_text_chars=settings.max_text_chars)
    try:
        report = coach.end()
    except AgentError:
        logger.exception("Report failed on session %s", session_id)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "The report could not be generated, try again")

    with connect() as conn:
        ended = end_session(conn, session_id, report.note, report.metrics)
    if not ended:
        raise HTTPException(status.HTTP_409_CONFLICT, "Session already ended")

    return report.model_dump()