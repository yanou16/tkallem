import json
import logging
import uuid
from datetime import datetime, timezone
from psycopg import Connection, sql

from app.schemas.enums import CorrectionType, ExplainLang, PracticeMode, SentenceStatus

logger = logging.getLogger(__name__)

# In-memory storage for local development when DATABASE_URL is not set
_MEM_SESSIONS: dict[str, dict] = {}
_MEM_TURNS: dict[str, list[dict]] = {}
_MEM_METRICS: dict[str, dict] = {}


def create_practice_session(
    conn: Connection | None,
    session_id: str,
    user_id: int,
    scenario_id: str,
    mode: PracticeMode | str,
    explain_lang: ExplainLang | str,
    state: dict,
) -> dict:
    mode_val = mode.value if hasattr(mode, "value") else str(mode)
    lang_val = explain_lang.value if hasattr(explain_lang, "value") else str(explain_lang)

    if conn is None:
        session_data = {
            "id": session_id,
            "user_id": user_id,
            "scenario_id": scenario_id,
            "mode": mode_val,
            "explain_lang": lang_val,
            "state": state,
            "note": None,
            "started_at": datetime.now(timezone.utc),
            "ended_at": None,
        }
        _MEM_SESSIONS[session_id] = session_data
        _MEM_TURNS[session_id] = []
        return session_data

    query = """
        INSERT INTO practice_sessions (id, user_id, scenario_id, mode, explain_lang, state)
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING id, user_id, scenario_id, mode, explain_lang, state, note, started_at, ended_at
    """
    row = conn.execute(
        query,
        (
            uuid.UUID(session_id),
            user_id,
            scenario_id,
            mode_val,
            lang_val,
            json.dumps(state),
        ),
    ).fetchone()
    conn.commit()
    return row


def get_practice_session(conn: Connection | None, session_id: str, user_id: int) -> dict | None:
    if conn is None:
        s = _MEM_SESSIONS.get(session_id)
        if s and s["user_id"] == user_id:
            return s
        return None

    query = """
        SELECT id, user_id, scenario_id, mode, explain_lang, state, note, started_at, ended_at
        FROM practice_sessions
        WHERE id = %s AND user_id = %s
    """
    return conn.execute(query, (uuid.UUID(session_id), user_id)).fetchone()


def update_practice_session_state(conn: Connection | None, session_id: str, state: dict) -> None:
    if conn is None:
        if session_id in _MEM_SESSIONS:
            _MEM_SESSIONS[session_id]["state"] = state
        return

    query = "UPDATE practice_sessions SET state = %s WHERE id = %s"
    conn.execute(query, (json.dumps(state), uuid.UUID(session_id)))
    conn.commit()


def save_turn(
    conn: Connection | None,
    session_id: str,
    position: int,
    transcript: str,
    reply: str,
    sentence_status: SentenceStatus | str,
    goal_covered: str | None,
    corrections: list[dict],
) -> None:
    status_val = sentence_status.value if hasattr(sentence_status, "value") else str(sentence_status)
    normalized_corrections = []
    for c in corrections:
        c_type = c.get("type")
        c_type_val = c_type.value if hasattr(c_type, "value") else str(c_type or "other")
        normalized_corrections.append({
            "original": c.get("original", ""),
            "fixed": c.get("fixed", ""),
            "type": c_type_val,
            "why": c.get("why", ""),
        })

    if conn is None:
        turn = {
            "position": position,
            "transcript": transcript,
            "reply": reply,
            "sentence_status": status_val,
            "goal_covered": goal_covered,
            "corrections": normalized_corrections,
            "created_at": datetime.now(timezone.utc),
        }
        if session_id in _MEM_TURNS:
            _MEM_TURNS[session_id].append(turn)
        return

    turn_query = """
        INSERT INTO turns (session_id, position, transcript, reply, sentence_status, goal_covered)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (session_id, position) DO UPDATE SET
            transcript = EXCLUDED.transcript,
            reply = EXCLUDED.reply,
            sentence_status = EXCLUDED.sentence_status,
            goal_covered = EXCLUDED.goal_covered
        RETURNING id
    """
    row = conn.execute(
        turn_query,
        (uuid.UUID(session_id), position, transcript, reply, status_val, goal_covered),
    ).fetchone()
    turn_id = row["id"]

    for c in normalized_corrections:
        corr_query = """
            INSERT INTO corrections (turn_id, original, fixed, type, why)
            VALUES (%s, %s, %s, %s, %s)
        """
        conn.execute(
            corr_query,
            (turn_id, c["original"], c["fixed"], c["type"], c["why"]),
        )
    conn.commit()


def end_practice_session(
    conn: Connection | None,
    session_id: str,
    note: str,
    metrics: dict,
) -> None:
    if conn is None:
        if session_id in _MEM_SESSIONS:
            _MEM_SESSIONS[session_id]["note"] = note
            _MEM_SESSIONS[session_id]["ended_at"] = datetime.now(timezone.utc)
        _MEM_METRICS[session_id] = metrics
        return

    sess_query = """
        UPDATE practice_sessions
        SET ended_at = now(), note = %s
        WHERE id = %s
    """
    conn.execute(sess_query, (note, uuid.UUID(session_id)))

    metrics_query = """
        INSERT INTO session_metrics (session_id, words, mistakes_per_100, words_per_answer, hesitations_per_min, speaking_seconds)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (session_id) DO UPDATE SET
            words = EXCLUDED.words,
            mistakes_per_100 = EXCLUDED.mistakes_per_100,
            words_per_answer = EXCLUDED.words_per_answer,
            hesitations_per_min = EXCLUDED.hesitations_per_min,
            speaking_seconds = EXCLUDED.speaking_seconds
    """
    conn.execute(
        metrics_query,
        (
            uuid.UUID(session_id),
            int(metrics.get("words", 0)),
            float(metrics.get("mistakes_per_100", 0.0)),
            float(metrics.get("words_per_answer", 0.0)),
            float(metrics.get("hesitations_per_min", 0.0)),
            float(metrics.get("speaking_seconds", 0.0)),
        ),
    )
    conn.commit()


def get_recent_practice_sessions(conn: Connection | None, user_id: int, limit: int = 5) -> list[dict]:
    if conn is None:
        user_sess = [s for s in _MEM_SESSIONS.values() if s["user_id"] == user_id]
        user_sess.sort(key=lambda s: s["started_at"], reverse=True)
        return user_sess[:limit]

    query = """
        SELECT ps.id, ps.scenario_id, ps.mode, ps.explain_lang, ps.note, ps.started_at, ps.ended_at,
               COALESCE(sm.speaking_seconds, 0) as speaking_seconds
        FROM practice_sessions ps
        LEFT JOIN session_metrics sm ON sm.session_id = ps.id
        WHERE ps.user_id = %s
        ORDER BY ps.started_at DESC
        LIMIT %s
    """
    return conn.execute(query, (user_id, limit)).fetchall()


def get_dashboard_data(conn: Connection | None, user_id: int) -> dict:
    if conn is None:
        total_seconds = sum(m.get("speaking_seconds", 0.0) for m in _MEM_METRICS.values())
        minutes = round(total_seconds / 60.0, 1)
        mistake_rates = [m.get("mistakes_per_100", 0.0) for m in _MEM_METRICS.values() if "mistakes_per_100" in m]
        avg_mistakes = round(sum(mistake_rates) / len(mistake_rates), 1) if mistake_rates else 0.0
        return {
            "speakingMinutesThisWeek": minutes,
            "streakDays": 1 if _MEM_SESSIONS else 0,
            "mistakesPer100Words": avg_mistakes,
            "mistakesChange": 0.0,
            "mistakesChangeLabel": "overall",
            "dailyGoalMinutes": 15,
            "dailyCompletedMinutes": min(minutes, 15.0),
        }

    query = """
        SELECT
            COALESCE(SUM(sm.speaking_seconds), 0) / 60.0 as speaking_minutes,
            COALESCE(AVG(sm.mistakes_per_100), 0.0) as avg_mistakes,
            COUNT(DISTINCT ps.id) as session_count
        FROM practice_sessions ps
        LEFT JOIN session_metrics sm ON sm.session_id = ps.id
        WHERE ps.user_id = %s
          AND ps.started_at >= (now() - interval '7 days')
    """
    row = conn.execute(query, (user_id,)).fetchone()
    minutes = round(float(row["speaking_minutes"] or 0.0), 1)
    mistakes = round(float(row["avg_mistakes"] or 0.0), 1)

    return {
        "speakingMinutesThisWeek": minutes,
        "streakDays": 1 if row["session_count"] > 0 else 0,
        "mistakesPer100Words": mistakes,
        "mistakesChange": 0.0,
        "mistakesChangeLabel": "this week",
        "dailyGoalMinutes": 15,
        "dailyCompletedMinutes": min(minutes, 15.0),
    }


def get_top_mistakes(conn: Connection | None, user_id: int, limit: int = 5) -> list[dict]:
    if conn is None:
        # Collect from memory
        items = []
        idx = 1
        for turns in _MEM_TURNS.values():
            for t in turns:
                for c in t.get("corrections", []):
                    items.append({
                        "id": str(idx),
                        "category": c.get("type", "grammar").capitalize(),
                        "original": c.get("original", ""),
                        "correction": c.get("fixed", ""),
                        "count": 1,
                    })
                    idx += 1
        return items[:limit]

    query = """
        SELECT
            c.type as category,
            c.original,
            c.fixed as correction,
            COUNT(*) as count
        FROM corrections c
        JOIN turns t ON t.id = c.turn_id
        JOIN practice_sessions ps ON ps.id = t.session_id
        WHERE ps.user_id = %s
        GROUP BY c.type, c.original, c.fixed
        ORDER BY count DESC
        LIMIT %s
    """
    rows = conn.execute(query, (user_id, limit)).fetchall()
    return [
        {
            "id": str(i + 1),
            "category": str(r["category"]).capitalize(),
            "original": r["original"],
            "correction": r["correction"],
            "count": r["count"],
        }
        for i, r in enumerate(rows)
    ]


def get_progress_data(conn: Connection | None, user_id: int) -> dict:
    if conn is None:
        mistake_rates = [m.get("mistakes_per_100", 0.0) for m in _MEM_METRICS.values()]
        words_rates = [m.get("words_per_answer", 0.0) for m in _MEM_METRICS.values()]
        hesitation_rates = [m.get("hesitations_per_min", 0.0) for m in _MEM_METRICS.values()]
        speaking_sec = sum(m.get("speaking_seconds", 0.0) for m in _MEM_METRICS.values())

        n = len(_MEM_METRICS) or 1
        return {
            "current": {
                "mistakes_per_100": round(sum(mistake_rates) / n, 1),
                "words_per_answer": round(sum(words_rates) / n, 1),
                "hesitations_per_min": round(sum(hesitation_rates) / n, 1),
                "speaking_seconds": round(speaking_sec, 1),
            },
            "baseline": {
                "mistakes_per_100": 8.0,
                "words_per_answer": 10.0,
                "hesitations_per_min": 4.0,
                "speaking_seconds": 0.0,
            },
            "top_mistakes": get_top_mistakes(conn, user_id),
        }

    query = """
        SELECT
            COALESCE(AVG(sm.mistakes_per_100), 0.0) as mistakes_per_100,
            COALESCE(AVG(sm.words_per_answer), 0.0) as words_per_answer,
            COALESCE(AVG(sm.hesitations_per_min), 0.0) as hesitations_per_min,
            COALESCE(SUM(sm.speaking_seconds), 0.0) as speaking_seconds
        FROM session_metrics sm
        JOIN practice_sessions ps ON ps.id = sm.session_id
        WHERE ps.user_id = %s
    """
    row = conn.execute(query, (user_id,)).fetchone()
    top_m = get_top_mistakes(conn, user_id)

    return {
        "current": {
            "mistakes_per_100": round(float(row["mistakes_per_100"] or 0.0), 1),
            "words_per_answer": round(float(row["words_per_answer"] or 0.0), 1),
            "hesitations_per_min": round(float(row["hesitations_per_min"] or 0.0), 1),
            "speaking_seconds": round(float(row["speaking_seconds"] or 0.0), 1),
        },
        "baseline": {
            "mistakes_per_100": 8.0,
            "words_per_answer": 10.0,
            "hesitations_per_min": 4.0,
            "speaking_seconds": 0.0,
        },
        "top_mistakes": top_m,
    }
