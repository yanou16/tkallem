"""WS /ws/groups/{id}: receive what happens in a group, live. Sending always goes through POST /groups/{id}/messages.

Protocol: the server accepts, then the first client message must be {"type": "auth", "token": "<Clerk token>"} within
AUTH_TIMEOUT_S (a token never goes in the URL: URLs end up in logs). Then the server sends {"type": "auth.ok"}, and
events: message.created, message.hidden, member.joined, member.left. The client sends {"type": "ping"} every 25 s and
gets {"type": "pong"}; anything else is ignored.
"""
import asyncio
import json
import logging

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from fastapi.concurrency import run_in_threadpool

from app import realtime
from app.config import settings
from app.db.connection import ConnFactory, get_conn_factory
from app.db.groups import get_group, is_member
from app.db.users import get_by_clerk_id
from app.security import verify_clerk_token

logger = logging.getLogger(__name__)

router = APIRouter()

AUTH_TIMEOUT_S = 5.0


async def _next_json(websocket: WebSocket):
    """The next client message decoded from JSON, or None when it is binary or not JSON (ignored)."""
    message = await websocket.receive()
    if message["type"] == "websocket.disconnect":
        raise WebSocketDisconnect(message.get("code", 1000))
    try:
        return json.loads(message.get("text") or "")
    except ValueError:
        return None


async def _authenticate(websocket: WebSocket) -> str | None:
    """The Clerk user id from the first message, or None after closing the connection (4401, or 1011 when Clerk
    cannot be reached). Only Clerk tokens: a guest token fails the check."""
    try:
        message = await asyncio.wait_for(_next_json(websocket), AUTH_TIMEOUT_S)
    except asyncio.TimeoutError:
        await websocket.close(code=realtime.CLOSE_UNAUTHORIZED, reason="Authentication timeout")
        return None
    token = message.get("token") if isinstance(message, dict) and message.get("type") == "auth" else None
    if not isinstance(token, str) or not token:
        await websocket.close(code=realtime.CLOSE_UNAUTHORIZED, reason="Send {\"type\": \"auth\", \"token\": ...} first")
        return None
    try:
        claims = await run_in_threadpool(verify_clerk_token, token)  # sync (network + crypto): in a thread
    except HTTPException as exc:
        if exc.status_code == status.HTTP_401_UNAUTHORIZED:
            await websocket.close(code=realtime.CLOSE_UNAUTHORIZED, reason="Invalid or expired token")
        else:  # 503: authentication not configured or Clerk unreachable
            await websocket.close(code=status.WS_1011_INTERNAL_ERROR, reason="Authentication unavailable")
        return None
    return claims.user_id


def _membership(connect: ConnFactory, group_id: int, clerk_user_id: str) -> tuple[int | None, int | None]:
    """(close code, user id): (None, id) for a member. A short connection of its own: no database connection is kept
    for the life of the WebSocket."""
    with connect() as conn:
        if get_group(conn, group_id) is None:
            return realtime.CLOSE_UNKNOWN_GROUP, None
        user = get_by_clerk_id(conn, clerk_user_id)
        if user is None or not is_member(conn, group_id, user["id"]):
            return realtime.CLOSE_NOT_A_MEMBER, None
        return None, user["id"]


@router.websocket("/ws/groups/{group_id}")
async def group_events(websocket: WebSocket, group_id: int, connect: ConnFactory = Depends(get_conn_factory)) -> None:
    await websocket.accept()  # accepted first, so that the client receives the close codes below

    # CORS does not apply to WebSockets: any web page could open one, so the origin is checked here.
    origin = (websocket.headers.get("origin") or "").rstrip("/")
    if origin not in settings.frontend_origins:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Origin not allowed")
        return

    try:
        clerk_user_id = await _authenticate(websocket)
        if clerk_user_id is None:
            return
        code, user_id = await run_in_threadpool(_membership, connect, group_id, clerk_user_id)
        if code is not None:
            await websocket.close(code=code)
            return

        connection = await realtime.manager.connect(group_id, user_id, websocket)
        try:
            # Checked again once registered: if she left between the first check and now, close.
            code, _ = await run_in_threadpool(_membership, connect, group_id, clerk_user_id)
            if code is not None:
                await websocket.close(code=code)
                return
            await websocket.send_json({"type": "auth.ok"})
            while True:
                message = await _next_json(websocket)
                if isinstance(message, dict) and message.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
                # anything else is ignored: sending goes through POST /groups/{id}/messages
        finally:
            await realtime.manager.disconnect(group_id, connection)
    except WebSocketDisconnect:
        pass  # the client went away, or the server closed it (she left the group)
