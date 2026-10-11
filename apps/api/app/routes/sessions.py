import json
import logging
from concurrent.futures import ThreadPoolExecutor
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import StreamingResponse
from psycopg import Connection
from tkallem_agent import AgentError, CoachSession, ScenarioNotFound

from app import credits
from app.config import settings
from app.db.connection import ConnFactory, get_conn, get_conn_factory
from app.db.sessions import create_session, end_session, get_session_for_user, save_turn, set_session_mode
from app.dependencies import get_current_user, user_for_claims
from app.schemas.sessions import SessionCreate, SessionDetail, SessionReport, SessionStarted, Spoken, TurnResult
from app.security import ClerkClaims, get_clerk_claims
from app.voice import SttError, TtsError, run_turn, stream_turn, synthesize, transcribe

logger = logging.getLogger(__name__)
_PRE = ThreadPoolExecutor(max_workers=32, thread_name_prefix="tkallem-turn")  # credit + transcription in parallel
SPEAK_LIMIT = 6  # voice replays per session and per process: each one is a paid TTS request with a daily quota
_speak_calls: dict[UUID, int] = {}

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


def _hear(session_id: UUID, data: bytes, filename: str, content_type: str) -> tuple[str, float | None, int, float]:
    """Spoken answer -> (text, seconds, long pauses, STT latency). Raises the HTTP error to show the student."""
    try:
        heard = transcribe(data, filename, content_type)
    except SttError as exc:
        logger.warning("Transcription failed on session %s: %s", session_id, exc)
        if exc.bad_audio:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "We could not read this recording, try again")
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Speech recognition is unavailable, try again or type your answer")
    if not any(c.isalpha() for c in heard.text):  # "" or "." : noise, nothing said
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "We did not hear anything, try again")
    if heard.unclear:
        logger.info("Unclear transcription on session %s: %r", session_id, heard.text[:80])
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "We could not understand this recording, speak a little closer and try again")
    return heard.text, heard.duration_s, heard.long_pauses(), heard.latency_s


def _spend(connect: ConnFactory, user: dict, session_id: UUID) -> credits.CreditStatus:
    with connect() as conn:
        try:
            return credits.spend(conn, user, session_id)  # the credit is taken before the coach is called
        except credits.NoCredits as exc:
            next_at = exc.next_refill_at.isoformat() if exc.next_refill_at else None
            raise HTTPException(status.HTTP_402_PAYMENT_REQUIRED, detail={"code": "no_credits", "balance": 0, "next_refill_at": next_at})
        except credits.DailyBudgetReached:
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                detail={"code": "daily_budget_reached", "message": "Today's free practice is used up, come back tomorrow"},
            )


def _refund(connect: ConnFactory, user: dict, session_id: UUID) -> None:
    try:  # a student never pays for an outage or for an answer that could not be processed
        with connect() as conn:
            credits.refund(conn, user, session_id)
    except Exception:
        logger.exception("Could not refund the credit of session %s", session_id)


def _save(connect: ConnFactory, session_id: UUID, coach: CoachSession, turn, expected_turns: int) -> dict | None:
    """Store the turn; None when another answer was saved meanwhile (two tabs)."""
    corrections = [c.model_dump() for c in turn.corrections]
    with connect() as conn:
        saved = save_turn(
            conn, session_id, coach.to_state(), coach.turns[-1].student_text, turn.reply, turn.sentence_status,
            turn.goal_covered, corrections, expected_turns=expected_turns,
        )
    if saved is None:
        return None
    return {
        "transcript": coach.turns[-1].student_text,
        "reply": turn.reply,
        "corrections": corrections,
        "sentence_status": turn.sentence_status,
        "finished": coach.finished,
    }


def _answer(session_id: UUID, session: dict, text: str, audio_seconds, pauses: int, want_audio: bool, llm, connect: ConnFactory) -> dict:
    """Run the coach, speak the reply, save the turn (JSON answer). Any exception means: nothing was saved."""
    expected_turns = len(session["state"]["turns"])
    coach = CoachSession.from_state(session["state"], llm=llm, max_text_chars=settings.max_text_chars)
    try:
        result = run_turn(coach, text, audio_seconds=audio_seconds, pauses=pauses, want_audio=want_audio)
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc))
    except AgentError:
        logger.exception("Agent failed on session %s", session_id)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "The coach is unavailable, send your answer again")
    answer = _save(connect, session_id, coach, result.turn, expected_turns)
    if answer is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "This session changed meanwhile, reload it")
    return {**answer, "reply_audio_url": result.speech.data_uri if result.speech else None}


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"


def _stream_answer(session_id: UUID, session: dict, user: dict, wallet, text: str, audio_seconds, pauses: int,
                   want_audio: bool, llm, connect: ConnFactory):
    """Server-Sent Events: transcript, reply (text), corrections and audio as soon as each exists, then done (the
    turn is saved) or error. The credit is given back if the turn is not saved, client gone included."""
    saved = False
    try:
        yield _sse("transcript", {"text": " ".join(text.split())})
        expected_turns = len(session["state"]["turns"])
        coach = CoachSession.from_state(session["state"], llm=llm, max_text_chars=settings.max_text_chars)
        answer = None
        try:
            for ev in stream_turn(coach, text, audio_seconds=audio_seconds, pauses=pauses, want_audio=want_audio):
                if ev["type"] == "reply":
                    yield _sse("reply", {"text": ev["reply"]})
                elif ev["type"] == "corrections":
                    yield _sse("corrections", {"corrections": ev["corrections"], "sentence_status": ev["sentence_status"]})
                elif ev["type"] == "audio":
                    yield _sse("audio", {"audio_url": ev["speech"].data_uri if ev["speech"] else None})
                elif ev["type"] == "done":
                    answer = _save(connect, session_id, coach, ev["turn"], expected_turns)
                    if answer is None:
                        yield _sse("error", {"status": 409, "detail": "This session changed meanwhile, reload it"})
                        return
                    saved = True
        except ValueError as exc:
            yield _sse("error", {"status": 422, "detail": str(exc)})
            return
        except AgentError:
            logger.exception("Agent failed on session %s", session_id)
            yield _sse("error", {"status": 502, "detail": "The coach is unavailable, send your answer again"})
            return
        yield _sse("done", {**answer, "credits": wallet.as_dict()})
    finally:
        if not saved:
            _refund(connect, user, session_id)


@router.get("/{session_id}", response_model=SessionDetail)
def read_session(
    session_id: UUID,
    user: dict = Depends(get_current_user),
    conn: Connection = Depends(get_conn),
) -> dict:
    """The conversation so far (text only, never audio), rebuilt from the stored state: no LLM call."""
    session = get_session_for_user(conn, session_id, user["id"])
    if session is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
    coach = CoachSession.from_state(session["state"], max_text_chars=settings.max_text_chars)
    lines = [{"role": "coach", "text": coach.opening}]
    for t in coach.turns:
        lines.append({"role": "student", "text": t.student_text, "status": t.status, "corrections": t.corrections})
        lines.append({"role": "coach", "text": t.reply})
    return {
        "session_id": session_id.hex,
        "scenario_id": coach.scenario.id,
        "title": coach.scenario.title,
        "mode": session["mode"],
        "lines": lines,
        "finished": coach.finished,
        "ended": session["ended_at"] is not None,
    }


@router.post("/{session_id}/speak", response_model=Spoken)
def speak_last_line(
    session_id: UUID,
    user: dict = Depends(get_current_user),
    connect: ConnFactory = Depends(get_conn_factory),
) -> dict:
    """The student switched to voice in the middle of a session: the coach says its last line again, and the coming
    replies are spoken too (the session becomes a voice session). Only the session's own last line can be spoken."""
    with connect() as conn:
        session = get_session_for_user(conn, session_id, user["id"])
        if session is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
        if session["ended_at"] is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, "Session already ended")
        set_session_mode(conn, session_id, user["id"], "voice")
    if _speak_calls.get(session_id, 0) >= SPEAK_LIMIT:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "The coach already repeated this many times: answer to continue")
    _speak_calls[session_id] = _speak_calls.get(session_id, 0) + 1
    coach = CoachSession.from_state(session["state"], max_text_chars=settings.max_text_chars)
    text = coach.turns[-1].reply if coach.turns else coach.opening
    try:
        audio_url = synthesize(text).data_uri  # outside the DB connection: TTS takes about a second
    except TtsError as exc:
        logger.warning("Speak without audio on session %s: %s", session_id, exc)
        audio_url = None
    return {"text": text, "audio_url": audio_url}


@router.post("/{session_id}/turn", response_model=TurnResult)
def send_turn(
    session_id: UUID,
    request: Request,
    text: str | None = Form(None),
    audio: UploadFile | None = File(None),
    claims: ClerkClaims = Depends(get_clerk_claims),
    connect: ConnFactory = Depends(get_conn_factory),
    llm=Depends(get_llm),
):
    """One answer, typed (`text`) or spoken (`audio`, webm from Chrome, mp4 from Safari): exactly one of the two.
    With `Accept: text/event-stream` the answer comes as Server-Sent Events (see _stream_answer), otherwise as JSON."""
    if (text is None) == (audio is None):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Send exactly one of `text` or `audio`")
    with connect() as conn:
        user = user_for_claims(conn, claims)
        session = get_session_for_user(conn, session_id, user["id"])
    if session is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
    if session["ended_at"] is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Session already ended")
    data = None
    if audio is not None:
        data = audio.file.read(settings.max_audio_bytes + 1)
        if len(data) > settings.max_audio_bytes:
            raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, "Recording too long, answer in a shorter message")

    # The credit and the transcription at the same time: neither needs the other, and each costs a few round trips.
    # (Without credits, one transcription is wasted: about 0.0001 $.)
    spending = _PRE.submit(_spend, connect, user, session_id)
    hearing = _PRE.submit(_hear, session_id, data, audio.filename or "answer.webm", audio.content_type or "audio/webm") if data is not None else None
    wallet = spending.result()  # 402 / 429 here
    audio_seconds, pauses = None, 0
    if hearing is not None:
        try:
            text, audio_seconds, pauses, _ = hearing.result()
        except Exception:
            _refund(connect, user, session_id)
            raise
    want_audio = session["mode"] == "voice" or audio is not None  # a spoken answer is always answered aloud

    if "text/event-stream" in request.headers.get("accept", ""):
        return StreamingResponse(
            _stream_answer(session_id, session, user, wallet, text, audio_seconds, pauses, want_audio, llm, connect),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},  # no proxy buffering: events go out at once
        )
    try:
        answer = _answer(session_id, session, text, audio_seconds, pauses, want_audio, llm, connect)
    except Exception:
        _refund(connect, user, session_id)
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
        user = user_for_claims(conn, claims)
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