import logging

from fastapi import APIRouter, Depends
from psycopg import Connection

from app.db.connection import get_conn
from app.db.users import update_profile
from app.dependencies import get_current_user
from app.schemas.me import Me, MeUpdate

router = APIRouter(prefix="/me", tags=["me"])
logger = logging.getLogger(__name__)


@router.get("", response_model=Me)
def read_me(user: dict = Depends(get_current_user)) -> dict:
    logger.info("Profile preview requested")
    return user


@router.patch("", response_model=Me)
def update_me(
    body: MeUpdate,
    user: dict = Depends(get_current_user),
    conn: Connection | None = Depends(get_conn),
) -> dict:
    changes = body.changes()
    logger.info("Profile update requested for fields: %s", sorted(changes))
    if conn is None:
        user.update(changes)
        logger.info("In-memory profile update completed")
        return user
    try:
        updated = update_profile(conn, user["id"], changes)
    except Exception:
        logger.exception("Profile update failed")
        raise
    logger.info("Profile update completed")
    return updated