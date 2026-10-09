import logging

from psycopg import Connection, sql

logger = logging.getLogger(__name__)

USER_COLUMNS = "id, clerk_user_id, email, first_name, level, explain_lang, created_at"
UPDATABLE_COLUMNS = {
    "first_name",
    "last_name",
    "avatar_url",
    "bio",
    "learning_goal",
    "daily_goal_minutes",
    "preferred_practice_mode",
    "focus_areas",
    "level",
    "explain_lang",
}


def get_by_clerk_id(conn: Connection, clerk_user_id: str) -> dict | None:
    return conn.execute(
        f"SELECT {USER_COLUMNS} FROM users WHERE clerk_user_id = %s",
        (clerk_user_id,),
    ).fetchone()


def get_or_create_by_clerk_id(conn: Connection, clerk_user_id: str) -> dict:
    logger.debug("Looking up user profile")
    user = get_by_clerk_id(conn, clerk_user_id)
    if user is not None:
        logger.debug("User profile found")
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
        logger.info("Created user profile on first access")
        return created

    logger.debug("User profile was created concurrently; fetching it again")
    return get_by_clerk_id(conn, clerk_user_id)


def update_profile(conn: Connection, user_id: int, changes: dict) -> dict:
    if not changes:
        raise ValueError("nothing to update")
    unknown = set(changes) - UPDATABLE_COLUMNS
    if unknown:
        raise ValueError(f"cannot update: {sorted(unknown)}")

    assignments = sql.SQL(", ").join(
        sql.SQL("{} = %s").format(sql.Identifier(column)) for column in changes
    )
    query = sql.SQL("UPDATE users SET {assignments} WHERE id = %s RETURNING {columns}").format(
        assignments=assignments,
        columns=sql.SQL(USER_COLUMNS),
    )
    updated = conn.execute(query, [*changes.values(), user_id]).fetchone()
    if updated is None:
        logger.error("Profile update returned no user row")
        raise LookupError("user profile was not found after update")
    return updated
