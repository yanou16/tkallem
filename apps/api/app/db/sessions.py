from uuid import UUID

from psycopg import Connection
from psycopg.types.json import Jsonb


def create_session(
    conn: Connection,
    session_id: UUID,
    user_id: int,
    scenario_id: str,
    mode: str,
    explain_lang: str,
    state: dict,
) -> None:
    conn.execute(
        """
        INSERT INTO practice_sessions (id, user_id, scenario_id, mode, explain_lang, state)
        VALUES (%s, %s, %s, %s, %s, %s)
        """,
        (session_id, user_id, scenario_id, mode, explain_lang, Jsonb(state)),
    )


def get_session_for_user(conn: Connection, session_id: UUID, user_id: int) -> dict | None:
    return conn.execute(
        """
        SELECT id, scenario_id, mode, explain_lang, state, started_at, ended_at, confidence_before, confidence_after
        FROM practice_sessions
        WHERE id = %s AND user_id = %s
        """,
        (session_id, user_id),
    ).fetchone()


def get_session_detail(conn: Connection, session_id: UUID, user_id: int) -> dict | None:
    """The session with what /end stored (note and metrics, NULL until then). None if it is not the user's."""
    return conn.execute(
        """
        SELECT s.id, s.scenario_id, s.mode, s.state, s.note, s.started_at, s.ended_at, s.confidence_before, s.confidence_after,
               m.mistakes_per_100, m.words_per_answer, m.hesitations_per_min, m.speaking_seconds
        FROM practice_sessions s
        LEFT JOIN session_metrics m ON m.session_id = s.id
        WHERE s.id = %s AND s.user_id = %s
        """,
        (session_id, user_id),
    ).fetchone()


def list_turns(conn: Connection, session_id: UUID, user_id: int) -> list[dict]:
    """The student's answers in order, each with its corrections (an empty list when there is none)."""
    return conn.execute(
        """
        SELECT t.position, t.transcript, t.reply, t.sentence_status,
               COALESCE(
                   json_agg(
                       json_build_object(
                           'original', c.original, 'fixed', c.fixed, 'type', c.type, 'why', c.why, 'rule', c.rule
                       )
                       ORDER BY c.id
                   ) FILTER (WHERE c.id IS NOT NULL),
                   '[]'::json
               ) AS corrections
        FROM turns t
        JOIN practice_sessions s ON s.id = t.session_id
        LEFT JOIN corrections c ON c.turn_id = t.id
        WHERE t.session_id = %s AND s.user_id = %s
        GROUP BY t.id
        ORDER BY t.position
        """,
        (session_id, user_id),
    ).fetchall()


def save_turn(
    conn: Connection,
    session_id: UUID,
    state: dict,
    transcript: str,
    reply: str,
    sentence_status: str,
    goal_covered: str | None,
    corrections: list[dict],
    *,
    expected_turns: int,
) -> int | None:
    updated = conn.execute(
        """
        UPDATE practice_sessions SET state = %s
        WHERE id = %s
          AND ended_at IS NULL
          AND jsonb_array_length(state -> 'turns') = %s
        RETURNING id
        """,
        (Jsonb(state), session_id, expected_turns),
    ).fetchone()
    if updated is None:
        return None

    turn = conn.execute(
        """
        INSERT INTO turns (session_id, position, transcript, reply, sentence_status, goal_covered)
        VALUES (
            %s,
            (SELECT COALESCE(MAX(position), 0) + 1 FROM turns WHERE session_id = %s),
            %s, %s, %s, %s
        )
        RETURNING id
        """,
        (session_id, session_id, transcript, reply, sentence_status, goal_covered),
    ).fetchone()

    if corrections:
        with conn.cursor() as cur:
            cur.executemany(
                """
                INSERT INTO corrections (turn_id, original, fixed, type, why, rule)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                # rule is optional: NULL when the agent left it out.
                [(turn["id"], c["original"], c["fixed"], c["type"], c["why"], c.get("rule")) for c in corrections],
            )
    return turn["id"]


def set_session_mode(conn: Connection, session_id: UUID, user_id: int, mode: str) -> None:
    conn.execute("UPDATE practice_sessions SET mode = %s WHERE id = %s AND user_id = %s", (mode, session_id, user_id))


def end_session(conn: Connection, session_id: UUID, note: str, metrics: dict) -> bool:
    ended = conn.execute(
        """
        UPDATE practice_sessions SET ended_at = now(), note = %s
        WHERE id = %s AND ended_at IS NULL
        RETURNING id
        """,
        (note, session_id),
    ).fetchone()
    if ended is None:
        return False

    conn.execute(
        """
        INSERT INTO session_metrics
            (session_id, words, mistakes_per_100, words_per_answer, hesitations_per_min, speaking_seconds)
        VALUES (%s, %s, %s, %s, %s, %s)
        """,
        (
            session_id,
            metrics["words"],
            metrics["mistakes_per_100"],
            metrics["words_per_answer"],
            metrics["hesitations_per_min"],
            metrics["speaking_seconds"],
        ),
    )
    return True

def list_sessions_for_user(conn: Connection, user_id: int, limit: int) -> list[dict]:
    return conn.execute(
        """
        SELECT id, scenario_id, started_at, ended_at,
               jsonb_array_length(state -> 'turns') AS answered
        FROM practice_sessions
        WHERE user_id = %s
        ORDER BY started_at DESC, id DESC
        LIMIT %s
        """,
        (user_id, limit),
    ).fetchall()

def list_corrected_answers(conn: Connection, user_id: int, limit: int) -> list[dict]:
    """The student's answers that had corrections, newest session first, each with its corrections ("Phrases").
    A real interview still running is left out: nothing of it is shown before its report. `position` starts at 1."""
    return conn.execute(
        """
        SELECT s.id AS session_id, s.scenario_id, s.started_at, t.position, t.transcript,
               json_agg(
                   json_build_object('original', c.original, 'fixed', c.fixed, 'type', c.type, 'why', c.why, 'rule', c.rule)
                   ORDER BY c.id
               ) AS corrections
        FROM turns t
        JOIN practice_sessions s ON s.id = t.session_id
        JOIN corrections c ON c.turn_id = t.id
        WHERE s.user_id = %s
          AND NOT (s.ended_at IS NULL AND s.state ->> 'feedback_mode' IS NOT DISTINCT FROM 'interview')
        GROUP BY t.id, s.id
        ORDER BY s.started_at DESC, s.id DESC, t.position
        LIMIT %s
        """,
        (user_id, limit),
    ).fetchall()


def previous_finished(conn: Connection, user_id: int, session_id: UUID, before) -> tuple[dict | None, int]:
    """The student's last finished session before `before` (its metrics, None if there is none) and how many they
    finished before it: the report opens with the progress since then (app/progress_line.py)."""
    rows = conn.execute(
        """
        SELECT m.mistakes_per_100, m.words_per_answer, m.hesitations_per_min, m.speaking_seconds, s.state
        FROM practice_sessions s
        JOIN session_metrics m ON m.session_id = s.id
        WHERE s.user_id = %s AND s.id <> %s AND s.ended_at IS NOT NULL AND s.ended_at < %s
        ORDER BY s.ended_at DESC
        """,
        (user_id, session_id, before),
    ).fetchall()
    return (dict(rows[0]) if rows else None), len(rows)


def set_confidence(conn: Connection, session_id: UUID, user_id: int, when: str, value: int) -> bool:
    """The student's 1-to-5 answer to "How confident do you feel?", before or after. False if it is not their session."""
    column = {"before": "confidence_before", "after": "confidence_after"}[when]  # a fixed pair: never user text in the SQL
    row = conn.execute(
        f"UPDATE practice_sessions SET {column} = %s WHERE id = %s AND user_id = %s RETURNING id",
        (value, session_id, user_id),
    ).fetchone()
    return row is not None


def confidence_summary(conn: Connection) -> dict:
    """Over every session where both answers exist: how many, and the average before and after (docs/IMPACT.md)."""
    return conn.execute(
        """
        SELECT count(*) AS sessions,
               round(avg(confidence_before)::numeric, 2) AS before,
               round(avg(confidence_after)::numeric, 2) AS after
        FROM practice_sessions
        WHERE confidence_before IS NOT NULL AND confidence_after IS NOT NULL
        """
    ).fetchone()
