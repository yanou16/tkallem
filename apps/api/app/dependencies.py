from fastapi import Depends, HTTPException, status
from psycopg import Connection

from app.db.connection import get_conn
from app import guests
from app.db.users import get_by_clerk_id, get_or_create_by_clerk_id
from app.security import ClerkClaims, get_clerk_claims


def user_for_claims(conn: Connection, claims: ClerkClaims) -> dict:
    """The user behind a token. Guests are only created by POST /guests (credits, address limits): a valid guest token
    whose row is gone is refused (401), and the app then asks for a new guest instead of a level-less account
    appearing silently. Signed-in students are created on first call."""
    if guests.is_guest_clerk_id(claims.user_id):
        user = get_by_clerk_id(conn, claims.user_id)
        if user is None:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Unknown guest", headers={"WWW-Authenticate": "Bearer"})
        return user
    return get_or_create_by_clerk_id(conn, claims.user_id)


def get_current_user(
    claims: ClerkClaims = Depends(get_clerk_claims),
    conn: Connection = Depends(get_conn),
) -> dict:
    return user_for_claims(conn, claims)
