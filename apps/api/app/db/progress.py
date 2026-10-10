from datetime import date, timedelta

from psycopg import Connection

TIMEZONE = "Africa/Algiers"


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