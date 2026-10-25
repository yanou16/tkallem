"""ICE servers for the voice call.

A call is a direct audio connection between the browser and our server. On Azure App Service the server sits in a
container whose only address is an internal one (169.254.x.x) and which accepts no inbound UDP, so a browser can never
reach it: the call stays on "connecting". A TURN relay on the Internet fixes that: both sides connect out to it and the
audio goes through it. Cloudflare's TURN service gives out short-lived credentials from a key that stays on the server:

  CLOUDFLARE_TURN_KEY_ID and CLOUDFLARE_TURN_API_TOKEN (App Service settings, never in the repository).

Without them, or if Cloudflare cannot be reached, the list is empty and the call tries a direct connection (which works
on a developer's machine).

Every call gets its own credentials, one set for the browser and one for our server's peer: sharing one username between
all the peers made the server's TURN requests fail with 401 on production (24 October). They live for a few hours
(`turn_credentials_ttl_secs`), which is longer than any session.
"""
import asyncio
import logging
import threading
import time

import httpx
from aioice import stun, turn

from app.config import settings

logger = logging.getLogger(__name__)

ENDPOINT = "https://rtc.live.cloudflare.com/v1/turn/keys/{key_id}/credentials/generate-ice-servers"
RETRY_AFTER_FAILURE_S = 30  # do not call Cloudflare on every request while it is unreachable

_lock = threading.Lock()
_down_until = 0.0  # while Cloudflare is failing, do not ask again for RETRY_AFTER_FAILURE_S


def configured() -> bool:
    return bool(settings.cloudflare_turn_key_id and settings.cloudflare_turn_api_token)


def reset() -> None:
    global _down_until
    with _lock:
        _down_until = 0.0


def _fetch(client: httpx.Client | None) -> list[dict]:
    ttl = settings.turn_credentials_ttl_secs
    http = client or httpx.Client(timeout=httpx.Timeout(5.0, connect=3.0))
    try:
        r = http.post(
            ENDPOINT.format(key_id=settings.cloudflare_turn_key_id),
            headers={"Authorization": f"Bearer {settings.cloudflare_turn_api_token}"},
            json={"ttl": ttl},
        )
        r.raise_for_status()
        servers = r.json().get("iceServers")
    finally:
        if client is None:
            http.close()
    if not isinstance(servers, list) or not servers:
        raise ValueError("Cloudflare returned no ICE servers")
    return servers


def all_ice_servers(client: httpx.Client | None = None, now=time.monotonic) -> list[dict]:
    """New RTCIceServer entries from Cloudflare ({"urls": [...], "username", "credential"}); [] if none."""
    global _down_until
    if not configured():
        return []
    with _lock:
        if now() < _down_until:
            return []
    try:
        return _fetch(client)
    except (httpx.HTTPError, ValueError) as e:
        logger.warning("TURN credentials unavailable (%s): the call will try a direct connection", type(e).__name__)
        with _lock:
            _down_until = now() + RETRY_AFTER_FAILURE_S
        return []


def browser_ice_servers(client: httpx.Client | None = None, now=time.monotonic) -> list[dict]:
    """For the browser: everything but the port-53 URLs, which browsers block and which only make the connection wait."""
    out = []
    for server in all_ice_servers(client, now):
        urls = [u for u in _as_list(server.get("urls")) if not _port_is(u, 53)]
        if urls:
            out.append({**server, "urls": urls})
    return out


def server_ice_servers(client: httpx.Client | None = None, now=time.monotonic) -> list[dict]:
    """For our own WebRTC peer: STUN, and TURN over UDP on port 443 only.

    The relay talks to it in UDP (TCP and TLS are for browsers). Port 443 rather than 3478: on production, with the same
    credentials, the TURN client of aiortc allocated a relay on 3478 but every following ChannelBind was answered 401;
    the same client works against port 443 from a laptop. It also takes the one URL aiortc would otherwise pick first."""
    out = []
    for server in all_ice_servers(client, now):
        urls = _as_list(server.get("urls"))
        keep = [u for u in urls if u.startswith("stun:") and not _port_is(u, 53)]
        turn_udp = [u for u in urls if u.startswith("turn:") and "transport=udp" in u and not _port_is(u, 53)]
        keep += [u for u in turn_udp if _port_is(u, 443)] or turn_udp[:1]
        if keep:
            out.append({**server, "urls": keep})
    return out


def _as_list(urls) -> list[str]:
    return [urls] if isinstance(urls, str) else list(urls or [])


def _port_is(url: str, port: int) -> bool:
    host = url.split("?", 1)[0].split(":", 2)
    return len(host) == 3 and host[2] == str(port)


def _turn_target(servers: list[dict]) -> tuple[str, int, str, str] | None:
    """(host, port, username, credential) of the first TURN UDP URL of `servers`."""
    for server in servers:
        for url in _as_list(server.get("urls")):
            if url.startswith("turn:") and "transport=udp" in url and server.get("username"):
                host, port = url[len("turn:"):].split("?", 1)[0].rsplit(":", 1)
                return host, int(port), server["username"], server["credential"]
    return None


async def warm_relay(servers: list[dict], attempts: int = 3, timeout: float = 1.2) -> bool:
    """Open and close a TURN allocation before the call's own peer opens one.

    On production the first allocation after a quiet period often gets no answer from Cloudflare (four requests in a row
    unanswered for 5 seconds, while a STUN request to the same provider is answered in 1 ms), so the peer has no relay
    address, the browser cannot reach it, and the first caller sees the call fail; the next attempts, seconds later, all
    work. A short allocation here, retried, finds the path open (or opens it) so that the real one does not run into it.
    Returns whether an allocation succeeded; the call goes on either way, and the browser falls back to the voice message."""
    target = _turn_target(servers)
    if target is None:
        return False
    host, port, username, credential = target
    for attempt in range(1, attempts + 1):
        try:
            transport, _ = await asyncio.wait_for(
                turn.create_turn_endpoint(asyncio.DatagramProtocol, (host, port), username, credential), timeout
            )
        except (asyncio.TimeoutError, OSError, stun.TransactionError, ValueError) as e:
            logger.info("TURN pre-flight attempt %d/%d failed (%s)", attempt, attempts, type(e).__name__)
            continue
        transport.close()  # gives the allocation back
        logger.info("TURN pre-flight ok (attempt %d)", attempt)
        return True
    logger.warning("TURN pre-flight failed %d times: the call may have no relay", attempts)
    return False
