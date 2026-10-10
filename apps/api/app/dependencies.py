from fastapi import Depends
from psycopg import Connection

from app.db.connection import get_conn
from app.db.users import get_or_create_by_clerk_id
from app.security import ClerkClaims, get_clerk_claims


def get_current_user(
    claims: ClerkClaims = Depends(get_clerk_claims),
    conn: Connection = Depends(get_conn),
) -> dict:
    return get_or_create_by_clerk_id(conn, claims.user_id)