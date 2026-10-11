"""Guest tokens: a visitor without account gets a signed token and sends it as `Authorization: Guest <token>`.

Why a header and not a cookie: the front (Vercel) and the API live on different sites, and Safari blocks cookies set
by another site. The token is `g1.<uuid>.<signature>`; the signature is an HMAC of the uuid with GUEST_SECRET, so a
visitor cannot invent or change an identity. Tokens are only issued by POST /guests, which is rate limited.
"""
import hashlib
import hmac
import re
import uuid

from app.config import settings

PREFIX = "guest:"  # users.clerk_user_id of a guest: can never collide with Clerk ids (user_...)
_FORMAT = re.compile(r"^g1\.([0-9a-f]{32})\.([0-9a-f]{64})$")


class GuestsDisabled(RuntimeError):
    """GUEST_SECRET is not configured."""


def _secret() -> bytes:
    if len(settings.guest_secret) < 32:
        raise GuestsDisabled("GUEST_SECRET must be set (32+ characters) to enable guest mode")
    return settings.guest_secret.encode()


def _sign(guest_id: str, purpose: bytes = b"guest-token") -> str:
    return hmac.new(_secret(), purpose + b":" + guest_id.encode(), hashlib.sha256).hexdigest()


def new_guest_id() -> str:
    return uuid.uuid4().hex


def issue(guest_id: str) -> str:
    return f"g1.{guest_id}.{_sign(guest_id)}"


def verify(token: str) -> str | None:
    """The guest id if the token is genuine, otherwise None. Constant-time comparison."""
    m = _FORMAT.match(token or "")
    if not m or len(settings.guest_secret) < 32:
        return None
    guest_id, signature = m.groups()
    return guest_id if hmac.compare_digest(signature, _sign(guest_id)) else None


def clerk_id(guest_id: str) -> str:
    return f"{PREFIX}{guest_id}"


def is_guest_clerk_id(value: str) -> bool:
    return value.startswith(PREFIX)


def hash_ip(ip: str) -> str:
    """Keyed hash of a network address: enough to count guests per address, useless to recover the address."""
    return hmac.new(_secret(), b"ip:" + ip.encode(), hashlib.sha256).hexdigest()[:32]
