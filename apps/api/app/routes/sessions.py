import json
from datetime import datetime, timezone
import logging
import time
from collections import deque
from concurrent.futures import ThreadPoolExecutor
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import StreamingResponse
from psycopg import Connection
from tkallem_agent import AgentError, CoachSession, HintError, ScenarioNotFound, freeze_compare, freeze_summary, match_repeat

from app import credits
from app.config import settings
from app.db.connection import ConnFactory, get_conn, get_conn_factory
from app.db.sessions import (
    create_session,
    end_session,
    get_session_detail,
    get_session_for_user,
    list_turns,
    previous_finished,
    save_turn,
    set_session_mode,
)
from app.dependencies import get_current_user, user_for_claims
from app.progress_line import progress_line
from app.schemas.sessions import (
    HintRequest, HintResult, RepeatResult, SessionCreate, SessionDetail, SessionReport, SessionStarted, Spoken,
    TurnResult,
)
from app.security import ClerkClaims, get_clerk_claims
from app.voice import SttError, TtsError, run_turn, stream_turn, synthesize, transcribe

logger = logging.getLogger(__name__)
_PRE = ThreadPoolExecutor(max_workers=32, thread_name_prefix="tkallem-turn")  # credit + transcription in parallel
SPEAK_LIMIT = 6  # voice replays per session and per process: each one is a paid TTS request with a daily quota
_speak_calls: dict[UUID, int] = {}
HINT_LIMIT = 2  # hints per question (docs/JURY_BRIEF.md): help to start, not to answer
HINTS_PER_HOUR = 30  # per student and per process: hints are free for the student but each is a paid model call
_hint_calls: dict[tuple[UUID, int], int] = {}
_hint_times: dict[str, deque] = {}
REPEAT_LIMIT = 3  # tries per corrected answer (docs/JURY_BRIEF.md)
REPEATS_PER_HOUR = 40  # per student and per process: each try is a paid transcription
_repeat_calls: dict[tuple[UUID, int], int] = {}
_repeat_times: dict[str, deque] = {}

router = APIRouter(prefix="/sessions", tags=["sessions"])

METRIC_KEYS = ("mistakes_per_100", "words_per_answer", "hesitations_per_min", "speaking_seconds")


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


def _scenario_view(session: dict) -> dict:
    """Title, first question and progress, from the agent. A scenario removed since then still shows the session
    (as _summary() in routes/me.py): only POST /turn refuses to go on."""
    try:
        coach = CoachSession.from_state(session["state"])
    except ScenarioNotFound:
        return {
            "title": session["scenario_id"],
            "total_questions": None,
            "first_question": None,
            "finished": session["ended_at"] is not None,
        }
    guided = coach.scenario.mode == "guided"
    return {
        "title": coach.scenario.title,
        "total_questions": len(coach.scenario.questions) if guided else None,
        "first_question": coach.opening,
        "finished": coach.finished,
    }


@router.get("/{session_id}", response_model=SessionDetail)
def read_session(
    session_id: UUID,
    user: dict = Depends(get_current_user),
    conn: Connection = Depends(get_conn),
) -> dict:
    session = get_session_detail(conn, session_id, user["id"])
    if session is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")

    return {
        "session_id": session["id"].hex,
        "scenario_id": session["scenario_id"],
        "mode": session["mode"],
        "started_at": session["started_at"],
        "ended_at": session["ended_at"],
        **_scenario_view(session),
        "turns": _with_praise(list_turns(conn, session_id, user["id"]), session["state"]),
        "note": session["note"],
        "metrics": {key: session[key] for key in METRIC_KEYS} if session["ended_at"] else None,
        "progress": _progress(conn, user["id"], session),
        "freeze": _freeze_of(conn, user["id"], session),
    }


def _freeze(state: dict, before: dict | None) -> dict | None:
    """Freeze meter: the average wait before answering in this session, and the previous finished session's when the two
    are comparable (same kind of answers). None for a session without measures (before the freeze meter, old client)."""
    now = freeze_summary(state.get("turns", []))
    last = freeze_summary(before["state"].get("turns", [])) if before and before.get("state") else None
    return freeze_compare(now, last)


def _freeze_of(conn: Connection, user_id: int, session: dict) -> dict | None:
    if session["ended_at"] is None:
        return None
    before, _ = previous_finished(conn, user_id, session["id"], session["ended_at"])
    return _freeze(session["state"], before)


def _progress(conn: Connection, user_id: int, session: dict) -> str | None:
    """A finished session shows the same first line as its report did: progress since the session finished before it."""
    if session["ended_at"] is None:
        return None
    before, count = previous_finished(conn, user_id, session["id"], session["ended_at"])
    return progress_line({key: session[key] for key in METRIC_KEYS}, before, count)


def _with_praise(turns: list[dict], state: dict) -> list[dict]:
    """Praise and priority correction of each answer (improvement 4), from the session state the agent keeps: the
    turns table does not store them. Position 1 is the first answer."""
    logged = state.get("turns", [])
    out = []
    for t in turns:
        log = logged[t["position"] - 1] if 0 < t["position"] <= len(logged) else {}
        n = len(t.get("corrections") or [])
        priority = log.get("priority_index", 0)
        out.append({**t, "praise": log.get("praise"), "priority_index": priority if 0 <= priority < max(n, 1) else 0})
    return out


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
        "praise": turn.praise,
        "priority_index": turn.priority_index,
        "finished": coach.finished,
    }


def _number(raw: str | None) -> float | None:
    try:
        return float(raw) if raw is not None else None
    except ValueError:
        return None


def _answer(session_id: UUID, session: dict, text: str, audio_seconds, pauses: int, want_audio: bool, llm, connect: ConnFactory,
            think: float | None = None) -> dict:
    """Run the coach, speak the reply, save the turn (JSON answer). Any exception means: nothing was saved."""
    expected_turns = len(session["state"]["turns"])
    coach = CoachSession.from_state(session["state"], llm=llm, max_text_chars=settings.max_text_chars)
    try:
        result = run_turn(coach, text, audio_seconds=audio_seconds, pauses=pauses, think_seconds=think, want_audio=want_audio)
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
                   want_audio: bool, llm, connect: ConnFactory, think: float | None = None):
    """Server-Sent Events: transcript, reply (text), corrections and audio as soon as each exists, then done (the
    turn is saved) or error. The credit is given back if the turn is not saved, client gone included."""
    saved = False
    try:
        yield _sse("transcript", {"text": " ".join(text.split())})
        expected_turns = len(session["state"]["turns"])
        coach = CoachSession.from_state(session["state"], llm=llm, max_text_chars=settings.max_text_chars)
        answer = None
        try:
            for ev in stream_turn(coach, text, audio_seconds=audio_seconds, pauses=pauses, think_seconds=think, want_audio=want_audio):
                if ev["type"] == "reply":
                    yield _sse("reply", {"text": ev["reply"]})
                elif ev["type"] == "corrections":
                    yield _sse("corrections", {"corrections": ev["corrections"], "sentence_status": ev["sentence_status"],
                                               "praise": ev.get("praise"), "priority_index": ev.get("priority_index", 0)})
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


def _hourly_ok(log: dict[str, deque], user_key: str, limit: int, now: float) -> bool:
    times = log.setdefault(user_key, deque())
    while times and now - times[0] > 3600:
        times.popleft()
    if len(times) >= limit:
        return False
    times.append(now)
    return True


def _hint_rate_ok(user_key: str, now: float) -> bool:
    return _hourly_ok(_hint_times, user_key, HINTS_PER_HOUR, now)


@router.post("/{session_id}/hint", response_model=HintResult)
def ask_hint(
    session_id: UUID,
    body: HintRequest,
    user: dict = Depends(get_current_user),
    connect: ConnFactory = Depends(get_conn_factory),
    llm=Depends(get_llm),
) -> dict:
    """"Help me start" on the question the student is answering: the first words of an answer (`starter`), or their
    idea in French or Darija turned into English (`translate`). Free (no credit), at most HINT_LIMIT per question."""
    with connect() as conn:
        session = get_session_for_user(conn, session_id, user["id"])
    if session is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
    if session["ended_at"] is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Session already ended")
    if body.type == "translate" and not (body.text or "").strip():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Write your idea in French or Darija first")
    coach = CoachSession.from_state(session["state"], llm=llm, max_text_chars=settings.max_text_chars)
    if coach.current_question() is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "The interview is over: no question to help with")
    key = (session_id, len(coach.turns))  # a new question (or the same one asked again) after each answer
    used = _hint_calls.get(key, 0)
    if used >= HINT_LIMIT:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "You had 2 hints for this question: try to answer, even with a short sentence")
    if not _hint_rate_ok(str(user["id"]), time.monotonic()):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many hints in the last hour: try to answer on your own")
    _hint_calls[key] = used + 1
    try:
        hint = coach.hint(body.type, body.text)  # never fails on a provider error: the scenario's starter instead
    except HintError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc))
    except ValueError as exc:  # translate: text too long for an answer
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc))
    except AgentError:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Hints are unavailable right now")
    return {**hint.model_dump(), "remaining": HINT_LIMIT - used - 1}


@router.post("/{session_id}/repeat", response_model=RepeatResult)
def say_it_again(
    session_id: UUID,
    turn: int = Form(..., ge=0),
    audio: UploadFile = File(...),
    user: dict = Depends(get_current_user),
    connect: ConnFactory = Depends(get_conn_factory),
) -> dict:
    """"Say it again": the student says the corrected version of answer number `turn` (0 = first answer) out loud. The
    code decides if it matches (tkallem_agent.repeat). Free, at most REPEAT_LIMIT tries per answer; the interview does
    not move on, and it works after the session ended too (to practise from the report)."""
    with connect() as conn:
        session = get_session_for_user(conn, session_id, user["id"])
    if session is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
    coach = CoachSession.from_state(session["state"], max_text_chars=settings.max_text_chars)
    if turn >= len(coach.turns):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Answer not found")
    answer = coach.turns[turn]
    if not answer.corrections:
        raise HTTPException(status.HTTP_409_CONFLICT, "This answer had nothing to correct")
    key = (session_id, turn)
    used = _repeat_calls.get(key, 0)
    if used >= REPEAT_LIMIT:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "You tried 3 times: go on with the interview, you can practise it again later")
    if not _hourly_ok(_repeat_times, str(user["id"]), REPEATS_PER_HOUR, time.monotonic()):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many tries in the last hour: take a break and come back")
    data = audio.file.read(settings.max_audio_bytes + 1)
    if len(data) > settings.max_audio_bytes:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, "Recording too long: say only the corrected sentence")
    heard, _, _, _ = _hear(session_id, data, audio.filename or "repeat.webm", audio.content_type or "audio/webm")
    _repeat_calls[key] = used + 1  # counted once the recording was understood: a failed transcription costs no try
    result = match_repeat(answer.student_text, answer.corrections, heard)
    return {**result.model_dump(), "heard": heard, "tries_left": REPEAT_LIMIT - used - 1}


@router.post("/{session_id}/turn", response_model=TurnResult)
def send_turn(
    session_id: UUID,
    request: Request,
    text: str | None = Form(None),
    audio: UploadFile | None = File(None),
    think_seconds: str | None = Form(None),
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
    think = _number(think_seconds)  # freeze meter, measured by the app: a bad value is ignored, never an error

    if "text/event-stream" in request.headers.get("accept", ""):
        return StreamingResponse(
            _stream_answer(session_id, session, user, wallet, text, audio_seconds, pauses, want_audio, llm, connect, think),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},  # no proxy buffering: events go out at once
        )
    try:
        answer = _answer(session_id, session, text, audio_seconds, pauses, want_audio, llm, connect, think)
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
        before, count = previous_finished(conn, user["id"], session_id, datetime.now(timezone.utc))

    return {**report.model_dump(), "progress": progress_line(report.metrics, before, count),
            "freeze": _freeze(session["state"], before)}