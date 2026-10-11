import logging
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from psycopg import Connection
from tkallem_agent import AgentError, CoachSession, ScenarioNotFound

from app import credits
from app.config import settings
from app.db.connection import ConnFactory, get_conn, get_conn_factory
from app.db.sessions import create_session, end_session, get_session_for_user, save_turn
from app.db.users import get_or_create_by_clerk_id
from app.dependencies import get_current_user
from app.schemas.sessions import SessionCreate, SessionReport, SessionStarted, TurnResult
from app.security import ClerkClaims, get_clerk_claims
from app.voice import SttError, TtsError, run_turn, synthesize, transcribe

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
    audio_url = None
    if body.mode == "voice":  # the coach's first question is spoken too; a voice failure only means no audio
        try:
            audio_url = synthesize(coach.opening).data_uri
        except TtsError as exc:
            logger.warning("First question without audio: %s", exc)
    return {
        "session_id": coach.session_id,
        "first_question": {"text": coach.opening, "audio_url": audio_url},
    }


def _answer(session_id: UUID, session: dict, text: str | None, audio: UploadFile | None, llm, connect: ConnFactory) -> dict:
    """Transcribe (if spoken), run the coach, speak the reply, save the turn. Any exception means: nothing was saved."""
    audio_seconds, pauses, stt_s = None, 0, None
    if audio is not None:
        data = audio.file.read(settings.max_audio_bytes + 1)
        if len(data) > settings.max_audio_bytes:
            raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, "Recording too long, answer in a shorter message")
        try:
            heard = transcribe(data, audio.filename or "answer.webm", audio.content_type or "audio/webm")
        except SttError as exc:
            logger.warning("Transcription failed on session %s: %s", session_id, exc)
            if exc.bad_audio:
                raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "We could not read this recording, try again")
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Speech recognition is unavailable, try again or type your answer")
        if not heard.text.strip():
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "We did not hear anything, try again")
        if heard.unclear:
            logger.info("Unclear transcription on session %s: %r", session_id, heard.text[:80])
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "We could not understand this recording, speak a little closer and try again")
        text, audio_seconds, pauses, stt_s = heard.text, heard.duration_s, heard.long_pauses(), heard.latency_s

    expected_turns = len(session["state"]["turns"])
    coach = CoachSession.from_state(session["state"], llm=llm, max_text_chars=settings.max_text_chars)
    try:
        result = run_turn(coach, text, audio_seconds=audio_seconds, pauses=pauses, want_audio=session["mode"] == "voice")
        turn = result.turn
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

    logger.info(
        "turn session=%s mode=%s stt=%s agent_reply=%.2fs agent_total=%.2fs tts=%s",
        session_id, session["mode"], f"{stt_s:.2f}s" if stt_s else "-",
        result.timings.get("reply_ready", 0), result.timings.get("total", 0),
        f"{result.timings['tts_s']:.2f}s" if result.timings.get("tts_s") else "-",
    )
    return {
        "transcript": transcript,
        "reply": turn.reply,
        "reply_audio_url": result.speech.data_uri if result.speech else None,
        "corrections": corrections,
        "sentence_status": turn.sentence_status,
        "finished": coach.finished,
    }


@router.post("/{session_id}/turn", response_model=TurnResult)
def send_turn(
    session_id: UUID,
    text: str | None = Form(None),
    audio: UploadFile | None = File(None),
    claims: ClerkClaims = Depends(get_clerk_claims),
    connect: ConnFactory = Depends(get_conn_factory),
    llm=Depends(get_llm),
) -> dict:
    """One answer, typed (`text`) or spoken (`audio`, webm from Chrome, mp4 from Safari): exactly one of the two."""
    if (text is None) == (audio is None):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Send exactly one of `text` or `audio`")
    with connect() as conn:
        user = get_or_create_by_clerk_id(conn, claims.user_id)
        session = get_session_for_user(conn, session_id, user["id"])
    if session is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
    if session["ended_at"] is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Session already ended")

    with connect() as conn:
        try:
            wallet = credits.spend(conn, user, session_id)  # the credit is taken BEFORE the paid providers are called
        except credits.NoCredits as exc:
            next_at = exc.next_refill_at.isoformat() if exc.next_refill_at else None
            raise HTTPException(status.HTTP_402_PAYMENT_REQUIRED, detail={"code": "no_credits", "balance": 0, "next_refill_at": next_at})
        except credits.DailyBudgetReached:
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                detail={"code": "daily_budget_reached", "message": "Today's free practice is used up, come back tomorrow"},
            )

    try:
        answer = _answer(session_id, session, text, audio, llm, connect)
    except Exception:
        try:  # a student never pays for an outage or for an answer that could not be processed
            with connect() as conn:
                credits.refund(conn, user, session_id)
        except Exception:
            logger.exception("Could not refund the credit of session %s", session_id)
        raise
    answer["credits"] = wallet.as_dict()
    return answer


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