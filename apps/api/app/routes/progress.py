from fastapi import APIRouter, Depends
from psycopg import Connection

from app.db.connection import get_conn
from app.db.sessions import get_progress_data
from app.dependencies import get_current_user
from app.schemas.dashboard import ProgressData

router = APIRouter(prefix="/me/progress", tags=["progress"])


@router.get("", response_model=ProgressData)
def read_progress(
    user: dict = Depends(get_current_user),
    conn: Connection | None = Depends(get_conn),
) -> dict:
    return get_progress_data(conn, user["id"])
