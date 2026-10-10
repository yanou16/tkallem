import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db.connection import close_pool, open_pool

from app.routes.me import router as me_router
from app.routes.sessions import router as sessions_router
from app.routes.user_profile import router as user_profile_router
from app.routes.dashboard import router as dashboard_router
from app.routes.practice import router as practice_router
from app.routes.groups import router as groups_router

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

# Core MVP routes
app.include_router(me_router)
app.include_router(sessions_router)

# Feature routes
app.include_router(user_profile_router)
app.include_router(dashboard_router)
app.include_router(practice_router)
app.include_router(groups_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}