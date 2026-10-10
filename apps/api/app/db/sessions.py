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
        SELECT id, scenario_id, mode, explain_lang, state, started_at, ended_at
        FROM practice_sessions
        WHERE id = %s AND user_id = %s
        """,
        (session_id, user_id),
    ).fetchone()


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
                INSERT INTO corrections (turn_id, original, fixed, type, why)
                VALUES (%s, %s, %s, %s, %s)
                """,
                [(turn["id"], c["original"], c["fixed"], c["type"], c["why"]) for c in corrections],
            )
    return turn["id"]


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