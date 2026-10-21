import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.db.connection import ConnFactory, close_pool, get_conn_factory, open_pool

from app.routes.credits import router as credits_router
from app.routes.group_ws import router as group_ws_router
from app.routes.phrase_of_the_day import router as phrase_router
from app.routes.groups import router as groups_router
from app.routes.me import router as me_router
from app.routes.scenarios import router as scenarios_router
from app.routes.sessions import router as sessions_router
from app.routes.webrtc import router as webrtc_router
from app.voice import smallwebrtc_patch  # noqa: F401 - apply SmallWebRTC fix

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.database_url:
        open_pool()
    else:
        logger.warning("DATABASE_URL is not set: starting without a database")
    yield
    if settings.database_url:
        close_pool()


app = FastAPI(title="Tkallem API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,

    allow_origins=settings.frontend_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],  # DELETE: leaving a group

    allow_headers=["*"],
)

app.include_router(credits_router)
app.include_router(me_router)
app.include_router(groups_router)
app.include_router(group_ws_router)
app.include_router(phrase_router)
app.include_router(scenarios_router)
app.include_router(sessions_router)
app.include_router(webrtc_router)


@app.get("/health")
def health() -> dict[str, str]:
    # version: the git commit the image was built from (set by the image workflow), so a deploy can be checked
    return {"status": "ok", "version": os.getenv("TKALLEM_VERSION", "dev")}


READY_TIMEOUT_S = 2.0  # to get a connection from the pool, then again for SELECT 1
NO_STORE = {"Cache-Control": "no-store"}  # a probe must never read a cached answer


def _database_answers(connect: ConnFactory) -> None:
    """Raises when the pool gives no connection in time, or when SELECT 1 fails or runs longer than the timeout."""
    with connect(timeout=READY_TIMEOUT_S) as conn:
        conn.execute("SELECT set_config('statement_timeout', %s, true)", (str(int(READY_TIMEOUT_S * 1000)),))
        conn.execute("SELECT 1").fetchone()


@app.get("/ready")
async def ready(connect: ConnFactory = Depends(get_conn_factory)) -> JSONResponse:
    """Readiness, unlike /health (liveness, no database): can this process serve requests that need the database?
    503 without any detail when it cannot; the reason is only logged."""
    try:
        # The overall bound also covers a network that hangs, which statement_timeout alone cannot stop.
        await asyncio.wait_for(run_in_threadpool(_database_answers, connect), timeout=READY_TIMEOUT_S * 2 + 1)
    except Exception:
        logger.exception("Readiness check failed: the database is not reachable")
        return JSONResponse({"status": "not_ready"}, status_code=503, headers=NO_STORE)
    return JSONResponse({"status": "ready"}, headers=NO_STORE)
