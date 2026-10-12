import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db.connection import close_pool, open_pool

from app.routes.credits import router as credits_router
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
    allow_origins=[
        *settings.allowed_frontend_origins,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(credits_router)
app.include_router(me_router)
app.include_router(scenarios_router)
app.include_router(sessions_router)
app.include_router(webrtc_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}