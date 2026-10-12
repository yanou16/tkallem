"""WebRTC Signaling routes for Pipecat Voice Sessions in Tkallem."""
import asyncio
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from app.voice import smallwebrtc_patch  # noqa: F401 - apply SmallWebRTC fix
from pipecat.transports.smallwebrtc.connection import SmallWebRTCConnection
from pipecat.transports.smallwebrtc.request_handler import (
    SmallWebRTCPatchRequest,
    SmallWebRTCRequest,
    SmallWebRTCRequestHandler,
)
from tkallem_agent import CoachSession

from app.config import settings
from app.db.connection import ConnFactory, get_conn_factory
from app.db.sessions import get_session_for_user
from app.dependencies import user_for_claims
from app.security import ClerkClaims, get_clerk_claims
from app.voice.pipecat_pipeline import build_voice_pipeline

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sessions", tags=["webrtc"])

# Global SmallWebRTC request handler for managing peer connections
_webrtc_handler = SmallWebRTCRequestHandler()
_active_sessions: dict[UUID, asyncio.Task] = {}


@router.post("/{session_id}/webrtc")
async def handle_webrtc_offer(
    session_id: UUID,
    request: SmallWebRTCRequest,
    claims: ClerkClaims = Depends(get_clerk_claims),
    connect: ConnFactory = Depends(get_conn_factory),
) -> dict:
    """Negotiates a WebRTC session offer from the browser and launches the Pipecat pipeline."""
    with connect() as conn:
        user = user_for_claims(conn, claims)
        session = get_session_for_user(conn, session_id, user["id"])

    if session is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
    if session["ended_at"] is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Session already ended")

    coach = CoachSession.from_state(session["state"], max_text_chars=settings.max_text_chars)

    async def on_connection(webrtc_connection: SmallWebRTCConnection):
        logger.info(f"Establishing WebRTC voice session {session_id} for user {user['id']}")
        runner, task, processor = build_voice_pipeline(
            webrtc_connection=webrtc_connection,
            session_id=session_id,
            user=user,
            coach=coach,
            connect=connect,
        )

        async def run_session():
            try:
                await runner.run(task)
            except asyncio.CancelledError:
                logger.info(f"Voice session {session_id} cancelled")
            except Exception as e:
                logger.exception(f"Error running voice session {session_id}: {e}")
            finally:
                _active_sessions.pop(session_id, None)

        session_task = asyncio.create_task(run_session())
        _active_sessions[session_id] = session_task

    answer = await _webrtc_handler.handle_web_request(request, on_connection)
    if answer is None:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Failed to generate SDP answer")
    return answer


@router.patch("/{session_id}/webrtc")
async def handle_webrtc_ice_patch(
    session_id: UUID,
    request: SmallWebRTCPatchRequest,
    claims: ClerkClaims = Depends(get_clerk_claims),
):
    """Handles trickle ICE candidate updates from SmallWebRTC."""
    await _webrtc_handler.handle_patch_request(request)
    return {"status": "ok"}
