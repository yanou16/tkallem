"""SQL of the practice groups: membership (8 at most, one group at a time), messages and reports.

Concurrency: the limit of members is checked in the same transaction as the insert, after locking the group row
(SELECT ... FOR UPDATE), so two students joining the same group at the same time queue on that lock and the second one
counts the first one. Choosing or creating a group (join_best_group) is serialized per level with a transaction-level
advisory lock, so two students cannot create two "#N" clubs at once.
"""
from psycopg import Connection

GROUP_MAX_MEMBERS = 8  # may change: always checked under the lock of the group row
REPORTS_TO_HIDE = 3  # different members reporting a message hide it for the whole group
MESSAGES_PAGE_MAX = 100

_GROUPS_LOCK = 4207  # advisory lock namespace of join_best_group (any constant, only used here)
_LEVEL_KEYS = {"A2": 1, "B1": 2, "B2": 3, "C1": 4}

# A group with its member count and its last activity (the last visible message, NULL without messages).
_SUMMARY = """
    SELECT g.id, g.name, g.level, g.created_at,
           (SELECT count(*) FROM group_members m WHERE m.group_id = g.id) AS member_count,
           (SELECT max(msg.created_at) FROM group_messages msg
            WHERE msg.group_id = g.id AND msg.hidden_at IS NULL) AS last_activity
    FROM groups g
"""

# A message as the API shows it: its author, and whether the author has left the group since.
_MESSAGE = """
    SELECT msg.id, msg.group_id, msg.body, msg.created_at,
           msg.user_id AS author_id, u.first_name AS author_first_name,
           NOT EXISTS (
               SELECT 1 FROM group_members gm WHERE gm.group_id = msg.group_id AND gm.user_id = msg.user_id
           ) AS author_left
    FROM group_messages msg
    JOIN users u ON u.id = msg.user_id
"""


def get_group(conn: Connection, group_id: int) -> dict | None:
    return conn.execute(f"{_SUMMARY} WHERE g.id = %s", (group_id,)).fetchone()


def get_user_group(conn: Connection, user_id: int) -> dict | None:
    """The student's current group (with member count and last activity), or None."""
    return conn.execute(
        f"{_SUMMARY} WHERE g.id = (SELECT group_id FROM group_members WHERE user_id = %s)",
        (user_id,),
    ).fetchone()


def is_member(conn: Connection, group_id: int, user_id: int) -> bool:
    row = conn.execute(
        "SELECT EXISTS (SELECT 1 FROM group_members WHERE group_id = %s AND user_id = %s) AS member",
        (group_id, user_id),
    ).fetchone()
    return row["member"]


def list_members(conn: Connection, group_id: int) -> list[dict]:
    return conn.execute(
        """
        SELECT u.id, u.first_name, m.joined_at
        FROM group_members m
        JOIN users u ON u.id = m.user_id
        WHERE m.group_id = %s
        ORDER BY m.joined_at, u.id
        """,
        (group_id,),
    ).fetchall()


def recommended_groups(conn: Connection, level: str, limit: int | None = None,
                       max_members: int = GROUP_MAX_MEMBERS) -> list[dict]:
    """Groups of the level with room left, the most recently active first; groups without messages come last."""
    return conn.execute(
        f"""
        WITH summaries AS ({_SUMMARY} WHERE g.level = %(level)s)
        SELECT * FROM summaries
        WHERE member_count < %(max)s
        ORDER BY last_activity DESC NULLS LAST, member_count DESC, id
        LIMIT %(limit)s
        """,
        {"level": level, "max": max_members, "limit": limit},
    ).fetchall()


def join_group(conn: Connection, group_id: int, user_id: int, max_members: int = GROUP_MAX_MEMBERS) -> str:
    """'joined', 'not_found', 'full', or 'already_member' (of this group or another one: one group at a time).
    The caller commits: the lock on the group row is held until then."""
    group = conn.execute("SELECT id FROM groups WHERE id = %s FOR UPDATE", (group_id,)).fetchone()
    if group is None:
        return "not_found"
    # Read after taking the lock: a student who joined just before is counted.
    count = conn.execute("SELECT count(*) AS n FROM group_members WHERE group_id = %s", (group_id,)).fetchone()["n"]
    if count >= max_members:
        return "full"
    # ON CONFLICT covers both the primary key and UNIQUE (user_id): no exception, the transaction stays usable.
    inserted = conn.execute(
        "INSERT INTO group_members (group_id, user_id) VALUES (%s, %s) ON CONFLICT DO NOTHING RETURNING group_id",
        (group_id, user_id),
    ).fetchone()
    return "joined" if inserted else "already_member"


def join_best_group(conn: Connection, user_id: int, level: str, max_members: int = GROUP_MAX_MEMBERS) -> dict | None:
    """Joins the most active group of the level with room left, or creates "English B1 Club #N".
    Returns the joined group, or None when the student is already in a group. The caller commits."""
    # One choice at a time per level, until the transaction ends.
    conn.execute("SELECT pg_advisory_xact_lock(%s, %s)", (_GROUPS_LOCK, _LEVEL_KEYS[level]))
    for candidate in recommended_groups(conn, level, max_members=max_members):
        result = join_group(conn, candidate["id"], user_id, max_members)
        if result == "joined":
            return get_group(conn, candidate["id"])
        if result == "already_member":
            return None
        # "full": filled meanwhile by a direct join, try the next one

    number = conn.execute("SELECT count(*) + 1 AS n FROM groups WHERE level = %s", (level,)).fetchone()["n"]
    created = conn.execute(
        "INSERT INTO groups (name, level) VALUES (%s, %s) RETURNING id",
        (f"English {level} Club #{number}", level),
    ).fetchone()
    if join_group(conn, created["id"], user_id, max_members) != "joined":
        return None
    return get_group(conn, created["id"])


def leave_group(conn: Connection, group_id: int, user_id: int) -> bool:
    """Deletes the membership. The student's messages stay, shown as from a former member."""
    left = conn.execute(
        "DELETE FROM group_members WHERE group_id = %s AND user_id = %s RETURNING user_id",
        (group_id, user_id),
    ).fetchone()
    return left is not None


def insert_message(conn: Connection, group_id: int, user_id: int, body: str) -> dict | None:
    """Saves the message only if the author is a member, checked in the same statement. None otherwise."""
    return conn.execute(
        f"""
        WITH inserted AS (
            INSERT INTO group_messages (group_id, user_id, body)
            SELECT %(group_id)s, %(user_id)s, %(body)s
            WHERE EXISTS (
                SELECT 1 FROM group_members WHERE group_id = %(group_id)s AND user_id = %(user_id)s
            )
            RETURNING id, group_id, user_id, body, created_at
        )
        SELECT i.id, i.group_id, i.body, i.created_at,
               i.user_id AS author_id, u.first_name AS author_first_name, false AS author_left
        FROM inserted i
        JOIN users u ON u.id = i.user_id
        """,
        {"group_id": group_id, "user_id": user_id, "body": body},
    ).fetchone()


def list_messages(conn: Connection, group_id: int, *, before_id: int | None = None, after_id: int | None = None,
                  limit: int = 50) -> list[dict]:
    """Visible messages, oldest first. Without cursor: the latest page. before_id: the page before (scrolling up).
    after_id: what came after (catching up after a reconnection). Not both."""
    if before_id is not None and after_id is not None:
        raise ValueError("before_id and after_id cannot be used together")
    limit = max(1, min(limit, MESSAGES_PAGE_MAX))
    params = {"group_id": group_id, "before_id": before_id, "after_id": after_id, "limit": limit}
    if after_id is not None:
        return conn.execute(
            f"""{_MESSAGE}
            WHERE msg.group_id = %(group_id)s AND msg.hidden_at IS NULL AND msg.id > %(after_id)s
            ORDER BY msg.id
            LIMIT %(limit)s
            """,
            params,
        ).fetchall()
    newest_first = conn.execute(
        f"""{_MESSAGE}
        WHERE msg.group_id = %(group_id)s AND msg.hidden_at IS NULL
          AND (%(before_id)s::bigint IS NULL OR msg.id < %(before_id)s)
        ORDER BY msg.id DESC
        LIMIT %(limit)s
        """,
        params,
    ).fetchall()
    return newest_first[::-1]


def report_message(conn: Connection, group_id: int, message_id: int, reporter_id: int, reason: str,
                   reports_to_hide: int = REPORTS_TO_HIDE) -> str:
    """'reported', 'hidden' (this report hid it), 'not_found' (no such visible message in the group),
    'own_message' or 'already_reported'. The caller checks that the reporter is a member, and commits."""
    # Lock the message: simultaneous reports are counted one after the other, and it is hidden exactly once.
    message = conn.execute(
        "SELECT user_id, hidden_at FROM group_messages WHERE id = %s AND group_id = %s FOR UPDATE",
        (message_id, group_id),
    ).fetchone()
    if message is None or message["hidden_at"] is not None:
        return "not_found"
    if message["user_id"] == reporter_id:
        return "own_message"
    added = conn.execute(
        """
        INSERT INTO message_reports (message_id, reporter_id, reason) VALUES (%s, %s, %s)
        ON CONFLICT (message_id, reporter_id) DO NOTHING
        RETURNING message_id
        """,
        (message_id, reporter_id, reason),
    ).fetchone()
    if added is None:
        return "already_reported"
    reports = conn.execute(
        "SELECT count(*) AS n FROM message_reports WHERE message_id = %s", (message_id,)
    ).fetchone()["n"]
    if reports < reports_to_hide:
        return "reported"
    conn.execute("UPDATE group_messages SET hidden_at = now() WHERE id = %s AND hidden_at IS NULL", (message_id,))
    return "hidden"
