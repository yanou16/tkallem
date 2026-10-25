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
import logging
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
