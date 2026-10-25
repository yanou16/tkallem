"""WebRTC Signaling routes for Pipecat Voice Sessions in Tkallem."""
import asyncio
import logging
import uuid
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from app.voice import smallwebrtc_patch  # noqa: F401 - apply SmallWebRTC fix
from pipecat.transports.smallwebrtc.connection import IceServer, SmallWebRTCConnection
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
from app.voice import ice
from app.voice.pipecat_pipeline import build_voice_pipeline

logger = logging.getLogger(__name__)

if settings.voice_ice_debug:  # the network exchanges between our server and the TURN relay, for diagnosis
    for _name in ("aioice", "aiortc.rtcicetransport"):
        logging.getLogger(_name).setLevel(logging.DEBUG)

router = APIRouter(prefix="/sessions", tags=["webrtc"])

# Global SmallWebRTC request handler for managing peer connections
_webrtc_handler = SmallWebRTCRequestHandler()
_active_sessions: dict[UUID, asyncio.Task] = {}


def _own_session_or_404(connect: ConnFactory, claims: ClerkClaims, session_id: UUID) -> None:
    with connect() as conn:
        user = user_for_claims(conn, claims)
        if get_session_for_user(conn, session_id, user["id"]) is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")


@router.get("/{session_id}/ice-servers")
async def get_ice_servers(
    session_id: UUID,
    claims: ClerkClaims = Depends(get_clerk_claims),
    connect: ConnFactory = Depends(get_conn_factory),
) -> dict:
    """What the browser needs to reach the call: whether it is on, and the ICE (STUN/TURN relay) servers to use."""
    _own_session_or_404(connect, claims, session_id)
    servers = await asyncio.to_thread(ice.browser_ice_servers) if settings.voice_call_enabled else []
    return {"call_enabled": settings.voice_call_enabled, "ice_servers": servers}


@router.post("/{session_id}/webrtc")
async def handle_webrtc_offer(
    session_id: UUID,
    request: SmallWebRTCRequest,
    claims: ClerkClaims = Depends(get_clerk_claims),
    connect: ConnFactory = Depends(get_conn_factory),
) -> dict:
    """Negotiates a WebRTC session offer from the browser and launches the Pipecat pipeline."""
    if not settings.voice_call_enabled:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "The live call is switched off")
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

        # Cancel any stale pipeline task from a previous connection attempt for this session.
        # Without this, the old pipeline may send peerLeft to the new WebRTC connection.
        existing_task = _active_sessions.pop(session_id, None)
        if existing_task and not existing_task.done():
            logger.info(f"Cancelling stale pipeline task for session {session_id}")
            existing_task.cancel()
            try:
                await asyncio.wait_for(asyncio.shield(existing_task), timeout=2.0)
            except (asyncio.CancelledError, asyncio.TimeoutError):
                pass

        # Build the voice pipeline and capture all required variables.
        try:
            runner, task, processor = build_voice_pipeline(
                webrtc_connection=webrtc_connection,
                session_id=session_id,
                user=user,
                coach=coach,
                connect=connect,
            )
        except Exception as e:
            logger.exception(f"Failed to build voice pipeline for session {session_id}: {e}")
            webrtc_connection.send_app_message(
                {"type": "error", "code": "pipeline_init_error", "detail": f"Voice pipeline initialization failed: {e}"}
            )
            asyncio.create_task(webrtc_connection.disconnect())
            raise

        # Session task must capture runner, task, processor, and webrtc_connection
        # from the enclosing scope via closure.
        async def run_session():
            try:
                await runner.run(task)
            except asyncio.CancelledError:
                logger.info(f"Voice session {session_id} cancelled")
            except Exception as e:
                logger.exception(f"Error running voice session {session_id}: {e}")
                try:
                    await webrtc_connection.send_app_message(
                        {"type": "error", "code": "session_error", "detail": f"Voice session error: {e}"}
                    )
                except Exception:
                    pass
            finally:
                _active_sessions.pop(session_id, None)

        session_task = asyncio.create_task(run_session())
        _active_sessions[session_id] = session_task

        # Robust fallback: ensure the pipeline greeting runs even if
        # on_client_ready never fires. This prevents pipeline startup delay
        # on "second connections" where RTVI state may not be fully initialized.
        async def robust_greet_fallback():
            await asyncio.sleep(1.5)
            logger.info("Robust fallback: running greet for session %s", session_id)
            try:
                # Run greet through the processor which has the correct context.
                await processor.send_event({
                    "type": "bot_transcript",
                    "text": coach.opening or "Hello! I'm your English tutor. How are you today?",
                    "utterance_id": uuid.uuid4().hex,
                })
                processor.start_speaking(coach.opening or "Hello! I'm your English tutor. How are you today?")
            except Exception as e:
                logger.warning("Robust greet failed: %s", e)

        asyncio.create_task(robust_greet_fallback())

    relay = await asyncio.to_thread(ice.server_ice_servers)  # the relay credentials are renewed here, before each offer
    _webrtc_handler.update_ice_servers([IceServer(urls=server["urls"], username=server.get("username"), credential=server.get("credential")) for server in relay] or None)
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