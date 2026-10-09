import logging

from fastapi import Depends
from psycopg import Connection

from app.db.connection import get_conn
from app.db.users import get_or_create_by_clerk_id
from app.security import ClerkClaims, get_clerk_claims

logger = logging.getLogger(__name__)


_IN_MEMORY_USERS: dict[str, dict] = {}


def get_current_user(
    claims: ClerkClaims = Depends(get_clerk_claims),
    conn: Connection | None = Depends(get_conn),
) -> dict:
    logger.debug("Resolving current user profile")
    if conn is None:
        if claims.user_id not in _IN_MEMORY_USERS:
            _IN_MEMORY_USERS[claims.user_id] = {
                "id": 1,
                "clerk_user_id": claims.user_id,
                "email": None,
                "first_name": None,
                "last_name": None,
                "avatar_url": None,
                "bio": None,
                "learning_goal": None,
                "daily_goal_minutes": 15,
                "preferred_practice_mode": "text",
                "focus_areas": [],
                "learning_languages": [],
                "level": None,
                "explain_lang": "fr",
                "created_at": None,
            }
        return _IN_MEMORY_USERS[claims.user_id]

    try:
        user = get_or_create_by_clerk_id(conn, claims.user_id)
    except Exception:
        logger.exception("Failed to resolve current user profile")
        raise
    logger.debug("Current user profile resolved")
    return user