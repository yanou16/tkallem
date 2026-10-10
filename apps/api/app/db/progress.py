from datetime import date, timedelta
from typing import Literal

from psycopg import Connection, sql

TIMEZONE = "Africa/Algiers"
CURRENT_SIZE = 5
BASELINE_SIZE = 3


def count_streak(days: list[date], today: date) -> int:
    practiced = set(days)
    day = today if today in practiced else today - timedelta(days=1)
    streak = 0
    while day in practiced:
        streak += 1
        day -= timedelta(days=1)
    return streak


def get_activity(conn: Connection, user_id: int) -> dict:
    params = {"user_id": user_id, "tz": TIMEZONE}

    totals = conn.execute(
        """
        SELECT
            (now() AT TIME ZONE %(tz)s)::date AS today,
            COALESCE(SUM(m.speaking_seconds) FILTER (
                WHERE s.started_at >= now() - interval '7 days'
            ), 0) AS week_seconds,
            COALESCE(SUM(m.speaking_seconds) FILTER (
                WHERE (s.started_at AT TIME ZONE %(tz)s)::date = (now() AT TIME ZONE %(tz)s)::date
            ), 0) AS today_seconds
        FROM practice_sessions s
        JOIN session_metrics m ON m.session_id = s.id
        WHERE s.user_id = %(user_id)s
        """,
        params,
    ).fetchone()

    days = conn.execute(
        """
        SELECT DISTINCT (started_at AT TIME ZONE %(tz)s)::date AS day
        FROM practice_sessions
        WHERE user_id = %(user_id)s
        ORDER BY day DESC
        LIMIT 400
        """,
        params,
    ).fetchall()

    return {
        "week_seconds": float(totals["week_seconds"]),
        "today_seconds": float(totals["today_seconds"]),
        "streak_days": count_streak([row["day"] for row in days], totals["today"]),
    }

def combine_metrics(rows: list[dict]) -> dict:
    def weighted(value_key: str, weight_key: str) -> float | None:
        pairs = [
            (row[value_key], row[weight_key])
            for row in rows
            if row[value_key] is not None and row[weight_key]
        ]
        total_weight = sum(weight for _, weight in pairs)
        if not total_weight:
            return None
        return sum(value * weight for value, weight in pairs) / total_weight

    words = sum(row["words"] for row in rows)
    answers = sum(row["answers"] for row in rows)
    speaking = [row["speaking_seconds"] for row in rows if row["speaking_seconds"] is not None]

    return {
        "mistakes_per_100": weighted("mistakes_per_100", "words"),
        "words_per_answer": words / answers if answers else None,
        "hesitations_per_min": weighted("hesitations_per_min", "speaking_seconds"),
        "speaking_seconds": sum(speaking) / len(speaking) if speaking else None,
    }


_METRIC_ROWS = sql.SQL(
    """
    SELECT m.session_id, m.words, m.mistakes_per_100, m.hesitations_per_min, m.speaking_seconds,
           jsonb_array_length(s.state -> 'turns') AS answers
    FROM practice_sessions s
    JOIN session_metrics m ON m.session_id = s.id
    WHERE s.user_id = %s
    ORDER BY s.started_at {direction}, s.id {direction}
    LIMIT %s
    """
)


def _metric_rows(conn: Connection, user_id: int, direction: Literal["ASC", "DESC"], limit: int) -> list[dict]:
    query = _METRIC_ROWS.format(direction=sql.SQL(direction))
    return conn.execute(query, (user_id, limit)).fetchall()


def get_metrics(conn: Connection, user_id: int) -> dict:
    first = _metric_rows(conn, user_id, "ASC", BASELINE_SIZE)
    latest = _metric_rows(conn, user_id, "DESC", CURRENT_SIZE)

    first_ids = {row["session_id"] for row in first}
    recent = [row for row in latest if row["session_id"] not in first_ids]

    if not recent:
        return {"current": combine_metrics(first), "baseline": None}
    return {"current": combine_metrics(recent), "baseline": combine_metrics(first)}