from psycopg import Connection, sql

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


UPDATABLE_COLUMNS = {"level", "explain_lang"}


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
    return conn.execute(query, [*changes.values(), user_id]).fetchone()
