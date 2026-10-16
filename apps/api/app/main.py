import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db.connection import close_pool, open_pool

from app.routes.credits import router as credits_router
from app.routes.group_ws import router as group_ws_router
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
app.include_router(scenarios_router)
app.include_router(sessions_router)
app.include_router(webrtc_router)


@app.get("/health")
def health() -> dict[str, str]:
    # version: the git commit the image was built from (set by the image workflow), so a deploy can be checked
    return {"status": "ok", "version": os.getenv("TKALLEM_VERSION", "dev")}