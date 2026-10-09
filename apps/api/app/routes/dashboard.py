from fastapi import APIRouter, Depends
from psycopg import Connection

from app.db.connection import get_conn
from app.db.sessions import get_dashboard_data, get_top_mistakes
from app.dependencies import get_current_user
from app.schemas.dashboard import DashboardData, TopMistake

router = APIRouter(prefix="/api", tags=["dashboard"])


@router.get("/dashboard", response_model=DashboardData)
def dashboard(
    user: dict = Depends(get_current_user),
    conn: Connection | None = Depends(get_conn),
) -> dict:
    return get_dashboard_data(conn, user["id"])


@router.get("/mistakes/top", response_model=list[TopMistake])
def top_mistakes(
    user: dict = Depends(get_current_user),
    conn: Connection | None = Depends(get_conn),
) -> list[dict]:
    return get_top_mistakes(conn, user["id"], limit=5)
