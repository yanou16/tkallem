from fastapi import APIRouter, Depends
from psycopg import Connection

from app.db.connection import get_conn
from app.db.users import update_profile
from app.dependencies import get_current_user
from app.schemas.me import Me, MeUpdate

router = APIRouter(prefix="/me", tags=["me"])


@router.get("", response_model=Me)
def read_me(user: dict = Depends(get_current_user)) -> dict:
    return user


@router.patch("", response_model=Me)
def update_me(
    body: MeUpdate,
    user: dict = Depends(get_current_user),
    conn: Connection = Depends(get_conn),
) -> dict:
    return update_profile(conn, user["id"], body.changes())