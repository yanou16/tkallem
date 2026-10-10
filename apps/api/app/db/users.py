import json
from psycopg import Connection, sql

USER_COLUMNS = (
    "id, clerk_user_id, email, first_name, last_name, level, explain_lang, "
    "avatar_url, bio, learning_goal, daily_goal_minutes, preferred_practice_mode, "
    "focus_areas, learning_languages, preferences, created_at"
)

DB_UPDATABLE_COLUMNS = {
    "first_name", "last_name", "level", "explain_lang", "email",
    "avatar_url", "bio", "learning_goal", "daily_goal_minutes",
    "preferred_practice_mode", "focus_areas", "learning_languages",
    "preferences",
}


def _serialize(key: str, value) -> object:
    """Convert Python value to psycopg-compatible type for JSONB/array columns."""
    if key in ("learning_languages", "preferences") and isinstance(value, (dict, list)):
        return json.dumps(value)
    return value


def get_by_clerk_id(conn: Connection, clerk_user_id: str) -> dict | None:
    return conn.execute(
        f"SELECT {USER_COLUMNS} FROM users WHERE clerk_user_id = %s",
        (clerk_user_id,),
    ).fetchone()


def get_or_create_by_clerk_id(conn: Connection, clerk_user_id: str) -> dict:
    user = get_by_clerk_id(conn, clerk_user_id)
    if user is not None:
        return user

    created = conn.execute(
        f"""
        INSERT INTO users (clerk_user_id)
        VALUES (%s)
        ON CONFLICT (clerk_user_id) DO NOTHING
        RETURNING {USER_COLUMNS}
        """,
        (clerk_user_id,),
    ).fetchone()
    if created is not None:
        return created

    return get_by_clerk_id(conn, clerk_user_id)


def update_profile(conn: Connection, user_id: int, changes: dict) -> dict:
    if not changes:
        raise ValueError("nothing to update")

    unknown = set(changes) - DB_UPDATABLE_COLUMNS
    if unknown:
        changes = {k: v for k, v in changes.items() if k not in unknown}

    if not changes:
        return conn.execute(
            f"SELECT {USER_COLUMNS} FROM users WHERE id = %s", (user_id,)
        ).fetchone()

    values = [_serialize(k, v) for k, v in changes.items()]
    assignments = sql.SQL(", ").join(
        sql.SQL("{} = %s").format(sql.Identifier(col)) for col in changes
    )
    query = sql.SQL(
        "UPDATE users SET {assignments} WHERE id = %s RETURNING {columns}"
    ).format(
        assignments=assignments,
        columns=sql.SQL(USER_COLUMNS),
    )
    return conn.execute(query, [*values, user_id]).fetchone()
