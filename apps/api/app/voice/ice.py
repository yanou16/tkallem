"""ICE servers for the voice call.

A call is a direct audio connection between the browser and our server. On Azure App Service the server sits in a
container whose only address is an internal one (169.254.x.x) and which accepts no inbound UDP, so a browser can never
reach it: the call stays on "connecting". A TURN relay on the Internet fixes that: both sides connect out to it and the
audio goes through it. Cloudflare's TURN service gives out short-lived credentials from a key that stays on the server:

  CLOUDFLARE_TURN_KEY_ID and CLOUDFLARE_TURN_API_TOKEN (App Service settings, never in the repository).

Without them, or if Cloudflare cannot be reached, the list is empty and the call tries a direct connection (which works
on a developer's machine). Credentials are cached for half of their lifetime, so Cloudflare is called a few times a day.
"""
import logging
import threading
import time

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

ENDPOINT = "https://rtc.live.cloudflare.com/v1/turn/keys/{key_id}/credentials/generate-ice-servers"
RETRY_AFTER_FAILURE_S = 30  # do not call Cloudflare on every request while it is unreachable

_lock = threading.Lock()
_cache: dict = {"servers": [], "refresh_at": 0.0, "expires_at": 0.0}


def configured() -> bool:
    return bool(settings.cloudflare_turn_key_id and settings.cloudflare_turn_api_token)


def reset() -> None:
    with _lock:
        _cache.update(servers=[], refresh_at=0.0, expires_at=0.0)


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
    """The RTCIceServer entries Cloudflare gave ({"urls": [...], "username", "credential"}), cached; [] if none."""
    if not configured():
        return []
    with _lock:
        t = now()
        if t < _cache["refresh_at"]:
            return list(_cache["servers"])
        try:
            servers = _fetch(client)
        except (httpx.HTTPError, ValueError) as e:
            logger.warning("TURN credentials unavailable (%s): the call will try a direct connection", type(e).__name__)
            still_valid = t < _cache["expires_at"]
            _cache["refresh_at"] = t + RETRY_AFTER_FAILURE_S
            return list(_cache["servers"]) if still_valid else []
        ttl = settings.turn_credentials_ttl_secs
        _cache.update(servers=servers, refresh_at=t + ttl / 2, expires_at=t + ttl)
        return list(servers)


def browser_ice_servers(client: httpx.Client | None = None, now=time.monotonic) -> list[dict]:
    """For the browser: everything but the port-53 URLs, which browsers block and which only make the connection wait."""
    out = []
    for server in all_ice_servers(client, now):
        urls = [u for u in _as_list(server.get("urls")) if not _port_is(u, 53)]
        if urls:
            out.append({**server, "urls": urls})
    return out


def server_ice_servers(client: httpx.Client | None = None, now=time.monotonic) -> list[dict]:
    """For our own WebRTC peer: STUN and TURN over UDP only (the relay talks to it in UDP; TCP and TLS are for browsers)."""
    out = []
    for server in all_ice_servers(client, now):
        urls = [
            u for u in _as_list(server.get("urls"))
            if not _port_is(u, 53) and (u.startswith("stun:") or (u.startswith("turn:") and "transport=udp" in u))
        ]
        if urls:
            out.append({**server, "urls": urls})
    return out


def _as_list(urls) -> list[str]:
    return [urls] if isinstance(urls, str) else list(urls or [])


def _port_is(url: str, port: int) -> bool:
    host = url.split("?", 1)[0].split(":", 2)
    return len(host) == 3 and host[2] == str(port)
