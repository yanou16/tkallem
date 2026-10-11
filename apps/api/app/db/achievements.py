from psycopg import Connection

from app.db.progress import best_streak, get_practice_days


def get_achievement_facts(conn: Connection, user_id: int) -> dict:
    """The numbers the badges are computed from (no table: badges are derived from the sessions).
    A session is finished once /end stored its metrics, as in progress.py."""
    counts = conn.execute(
        """
        SELECT
            count(*) AS finished_sessions,
            count(*) FILTER (WHERE m.speaking_seconds IS NOT NULL) AS voice_sessions
        FROM practice_sessions s
        JOIN session_metrics m ON m.session_id = s.id
        WHERE s.user_id = %s
        """,
        (user_id,),
    ).fetchone()

    return {
        "finished_sessions": counts["finished_sessions"],
        "voice_sessions": counts["voice_sessions"],
        "best_streak": best_streak(get_practice_days(conn, user_id)),
    }
