import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db.connection import close_pool, open_pool

from app.routes.dashboard import router as dashboard_router
from app.routes.me import router as me_router
from app.routes.practice import router as practice_router
from app.routes.progress import router as progress_router
from app.routes.sessions import router as sessions_router
from app.routes.stubs import router as stubs_router

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not settings.clerk_jwks_url or not settings.clerk_issuer:
        logger.error(
            "Clerk authentication is not configured: set CLERK_JWKS_URL and "
            "CLERK_ISSUER in apps/api/.env"
        )
    if settings.database_url:
        logger.info("Opening database connection pool")
        try:
            open_pool()
        except Exception:
            logger.exception("Failed to open database connection pool during startup")
            raise
        logger.info("Database connection pool is ready")
    else:
        logger.warning("DATABASE_URL is not set: starting without a database")
    yield
    if settings.database_url:
        logger.info("Closing database connection pool")
        close_pool()


app = FastAPI(title="Tkallem API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(me_router)
app.include_router(sessions_router)
app.include_router(practice_router)
app.include_router(dashboard_router)
app.include_router(progress_router)
app.include_router(stubs_router)

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}