from psycopg import Connection

USER_COLUMNS = "id, clerk_user_id, email, first_name, level, explain_lang, created_at"


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