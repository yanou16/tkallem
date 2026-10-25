"""Monkeypatch for aioice's TURN client: understand the relay's Data indications.

Problem (seen on production, 25 October): a call through Cloudflare's TURN relay never connected. The server's log
(VOICE_ICE_DEBUG=true) showed its relay allocated, its channels bound, and the browser's connectivity checks arriving
from the relay, 124 of them in 15 seconds, but not one reached the ICE agent.

Cause: the relay hands a peer's packet to the client either as ChannelData (when the client bound a channel for that
peer) or as a STUN Data indication (RFC 5766 section 10.4), and a TURN client must accept both. aioice 0.10.2, the latest
release, only reads ChannelData: `TurnClientMixin.datagram_received` drops every Data indication, and its STUN parser
does not know the DATA attribute anyway. Cloudflare keeps sending Data indications, so everything the browser sent
through the relay was thrown away.

This reads the Data indication directly (DATA 0x0013 and XOR-PEER-ADDRESS 0x0012) and hands the payload to the ICE agent
exactly as aioice does for ChannelData. Everything else goes to the original method unchanged.
"""
import asyncio
import logging
import socket
import struct

from aioice import stun, turn

logger = logging.getLogger(__name__)

DATA_INDICATION = 0x0017  # method DATA (0x007), class indication
ATTR_XOR_PEER_ADDRESS = 0x0012
ATTR_DATA = 0x0013
MAGIC_COOKIE = b"\x21\x12\xa4\x42"


def parse_data_indication(data: bytes) -> tuple[bytes, tuple[str, int]] | None:
    """(payload, peer address) of a STUN Data indication, or None if `data` is anything else or is malformed."""
    if len(data) < 20 or data[4:8] != MAGIC_COOKIE or struct.unpack("!H", data[0:2])[0] != DATA_INDICATION:
        return None
    length = struct.unpack("!H", data[2:4])[0]
    end = min(20 + length, len(data))
    transaction_id = data[8:20]
    payload = peer = None
    pos = 20
    while pos + 4 <= end:
        attribute, size = struct.unpack("!HH", data[pos:pos + 4])
        value = data[pos + 4:pos + 4 + size]
        if len(value) < size:
            return None
        if attribute == ATTR_DATA:
            payload = value
        elif attribute == ATTR_XOR_PEER_ADDRESS:
            try:
                peer = stun.unpack_xor_address(value, transaction_id)
            except (ValueError, struct.error):
                return None
        pos += 4 + size + (-size % 4)  # attributes are padded to 4 bytes
    return (payload, peer) if payload is not None and peer is not None else None


_original = turn.TurnClientMixin.datagram_received


def datagram_received(self, data, addr):
    parsed = parse_data_indication(bytes(data)) if isinstance(data, (bytes, bytearray)) else None
    if parsed is not None:
        payload, peer = parsed
        if self.receiver is not None:
            self.receiver.datagram_received(payload, (peer[0], peer[1]))
        return
    _original(self, data, addr)


if turn.TurnClientMixin.datagram_received is _original:  # applied once, even if the module is imported twice
    turn.TurnClientMixin.datagram_received = datagram_received
    logger.info("aioice TurnClientMixin patched: relayed Data indications are delivered")


# ---- allocation retry ----
#
# Second problem, same investigation: on production the server's TURN allocation is sometimes never answered (the four
# retransmissions of aioice, 0.5 s to 3.5 s apart, all go unanswered), so the answer has no relay address and the browser
# cannot reach the server. A request from a new socket, a moment later, is answered at once (a pre-flight allocation
# was answered in 2 ms, then the real one 12 ms later was not). So the allocation is retried on a NEW socket instead of
# retransmitting on the one that is not being answered.

ALLOCATE_ATTEMPTS = 3
ALLOCATE_ATTEMPT_TIMEOUT = 1.5  # seconds; aioice gives the whole gathering about 5 s

_original_create_turn_endpoint = turn.create_turn_endpoint


async def create_turn_endpoint_with_retry(
    protocol_factory,
    server_addr,
    username,
    password,
    lifetime=turn.DEFAULT_ALLOCATION_LIFETIME,
    channel_refresh_time=turn.DEFAULT_CHANNEL_REFRESH_TIME,
    ssl=None,
    transport="udp",
):
    """aioice's `create_turn_endpoint` (UDP), with up to ALLOCATE_ATTEMPTS tries, each on a new socket."""
    if transport != "udp":
        return await _original_create_turn_endpoint(
            protocol_factory, server_addr, username, password, lifetime, channel_refresh_time, ssl, transport
        )
    loop = asyncio.get_event_loop()
    for attempt in range(1, ALLOCATE_ATTEMPTS + 1):
        inner_transport, inner_protocol = await loop.create_datagram_endpoint(
            lambda: turn.TurnClientUdpProtocol(
                server_addr, username=username, password=password, lifetime=lifetime, channel_refresh_time=channel_refresh_time
            ),
            remote_addr=server_addr,
        )
        sock = inner_transport.get_extra_info("socket")
        if sock is not None:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, turn.UDP_SOCKET_BUFFER_SIZE)
        try:
            protocol = protocol_factory()
            turn_transport = turn.TurnTransport(inner_protocol)
            await asyncio.wait_for(turn_transport._connect(protocol), ALLOCATE_ATTEMPT_TIMEOUT)
            if attempt > 1:
                logger.info("TURN allocation answered on attempt %d", attempt)
            return turn_transport, protocol
        except (asyncio.TimeoutError, stun.TransactionTimeout):
            inner_transport.close()
            logger.warning("TURN allocation attempt %d/%d unanswered", attempt, ALLOCATE_ATTEMPTS)
            if attempt == ALLOCATE_ATTEMPTS:
                raise
        except BaseException:  # an answer that is an error (401 after the retry, 486...) or a cancellation: no more tries
            inner_transport.close()
            raise


if turn.create_turn_endpoint is _original_create_turn_endpoint:
    turn.create_turn_endpoint = create_turn_endpoint_with_retry
    logger.info("aioice create_turn_endpoint patched: the allocation is retried on a new socket")
