"""aioice's TURN client must deliver the packets a relay hands over as Data indications (Cloudflare does)."""
import struct

import pytest
from aioice import stun, turn

from app.voice import aioice_turn_patch as patch


def data_indication(payload: bytes, peer=("104.30.145.175", 49141), transaction_id=b"0123456789ab") -> bytes:
    def attr(kind: int, value: bytes) -> bytes:
        return struct.pack("!HH", kind, len(value)) + value + b"\x00" * (-len(value) % 4)

    body = attr(patch.ATTR_XOR_PEER_ADDRESS, stun.pack_xor_address(peer, transaction_id)) + attr(patch.ATTR_DATA, payload)
    return struct.pack("!HH", patch.DATA_INDICATION, len(body)) + patch.MAGIC_COOKIE + transaction_id + body


class Receiver:
    def __init__(self):
        self.packets = []

    def datagram_received(self, data, addr):
        self.packets.append((data, addr))


class Client(turn.TurnClientMixin):
    """The mixin alone, with only what datagram_received touches."""

    def __init__(self):
        self.receiver = Receiver()
        self.channel_to_peer = {}
        self.transactions = {}


BINDING_REQUEST = stun.Message(message_method=stun.Method.BINDING, message_class=stun.Class.REQUEST)


def test_a_data_indication_reaches_the_ice_agent_with_the_peer_address():
    client = Client()
    client.datagram_received(data_indication(bytes(BINDING_REQUEST), peer=("104.30.145.175", 49141)), ("141.101.90.1", 443))
    assert client.receiver.packets == [(bytes(BINDING_REQUEST), ("104.30.145.175", 49141))]


def test_odd_sized_payloads_are_unpadded_and_ipv6_peers_work():
    client = Client()
    client.datagram_received(data_indication(b"abcde", peer=("2606:4700:48::1", 3478)), ("141.101.90.1", 443))
    assert client.receiver.packets == [(b"abcde", ("2606:4700:48::1", 3478))]


def test_channel_data_still_goes_through_the_original_code():
    client = Client()
    client.channel_to_peer[0x4000] = ("104.30.145.175", 47922)
    payload = b"hello world!"
    client.datagram_received(struct.pack("!HH", 0x4000, len(payload)) + payload, ("141.101.90.1", 443))
    assert client.receiver.packets == [(payload, ("104.30.145.175", 47922))]


@pytest.mark.parametrize("junk", [b"", b"\x00\x17", b"\x00\x17\x00\x00" + patch.MAGIC_COOKIE + b"x" * 12,  # a Data indication with neither attribute
                                  data_indication(b"x")[:-6]])  # cut in the middle of an attribute
def test_junk_and_truncated_packets_are_not_delivered_and_do_not_crash(junk):
    assert patch.parse_data_indication(junk) is None
    client = Client()
    client.datagram_received(junk, ("141.101.90.1", 443))
    assert client.receiver.packets == []


def test_other_stun_messages_from_the_relay_are_not_taken_for_data():
    allocate_ok = bytes(stun.Message(message_method=stun.Method.REFRESH, message_class=stun.Class.RESPONSE))
    assert patch.parse_data_indication(allocate_ok) is None


def test_the_patch_is_installed_on_the_real_client():
    assert turn.TurnClientMixin.datagram_received is patch.datagram_received
