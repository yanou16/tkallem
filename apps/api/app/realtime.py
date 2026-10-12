"""Live connections to the group chats, kept in memory (one API process, no Redis for the MVP).

The routes only call `manager.connect / disconnect / broadcast / close_member`: moving to several processes later
(Redis pub/sub) only changes this module.
"""
import asyncio
import logging
from dataclasses import dataclass

from fastapi import WebSocket

logger = logging.getLogger(__name__)

# WebSocket close codes (4000-4999 are free for applications, mirrored on HTTP 401/403/404).
CLOSE_UNAUTHORIZED = 4401  # token missing, invalid or too late
CLOSE_NOT_A_MEMBER = 4403  # not, or no longer, a member of the group
CLOSE_UNKNOWN_GROUP = 4404
SEND_TIMEOUT_S = 5.0  # a client that does not read for this long is treated as dead


@dataclass(eq=False)  # eq=False: two connections are equal only if they are the same object (hashable by identity)
class Connection:
    websocket: WebSocket
    user_id: int


class ConnectionManager:
    """group id -> the open connections of its members. One asyncio.Lock protects the dictionary: connections can be
    added, removed and listed by several coroutines (WebSocket routes, broadcasts) of the same event loop."""

    def __init__(self) -> None:
        self._groups: dict[int, set[Connection]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, group_id: int, user_id: int, websocket: WebSocket) -> Connection:
        connection = Connection(websocket, user_id)
        async with self._lock:
            self._groups.setdefault(group_id, set()).add(connection)
        return connection

    async def disconnect(self, group_id: int, connection: Connection) -> None:
        async with self._lock:
            self._remove(group_id, connection)

    async def broadcast(self, group_id: int, event: dict) -> None:
        """Sends the event to every connection of the group, and drops the connections that fail (closed tab, lost
        network, a client that stopped reading). Call it only after the change is committed."""
        # TODO: Redis pub/sub: publish the event on a channel per group, and let each process deliver it to its own
        # connections (the same loop as below).
        async with self._lock:
            targets = list(self._groups.get(group_id, ()))  # a copy: sending happens without holding the lock
        dead = []
        for connection in targets:
            try:
                await asyncio.wait_for(connection.websocket.send_json(event), SEND_TIMEOUT_S)
            except Exception:  # disconnected, or too slow: it will not receive anything any more
                dead.append(connection)
        if dead:
            logger.info("Dropping %d dead connection(s) of group %s", len(dead), group_id)
            async with self._lock:
                for connection in dead:
                    self._remove(group_id, connection)

    async def close_member(self, group_id: int, user_id: int, code: int = CLOSE_NOT_A_MEMBER) -> None:
        """Closes every connection of this member to this group (all her tabs), e.g. when she leaves it."""
        async with self._lock:
            mine = [c for c in self._groups.get(group_id, ()) if c.user_id == user_id]
            for connection in mine:
                self._remove(group_id, connection)
        for connection in mine:
            try:
                await connection.websocket.close(code=code)
            except Exception:  # already closed
                pass

    def connection_count(self, group_id: int) -> int:
        return len(self._groups.get(group_id, ()))

    def _remove(self, group_id: int, connection: Connection) -> None:
        connections = self._groups.get(group_id)
        if connections is None:
            return
        connections.discard(connection)
        if not connections:
            del self._groups[group_id]  # no empty sets left behind


manager = ConnectionManager()
