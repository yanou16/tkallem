from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from psycopg import Connection
from tkallem_agent import CoachSession, ScenarioNotFound

from app.config import settings
from app.db.connection import get_conn
from app.db.sessions import create_session
from app.dependencies import get_current_user
from app.schemas.sessions import SessionCreate, SessionStarted

router = APIRouter(prefix="/sessions", tags=["sessions"])


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