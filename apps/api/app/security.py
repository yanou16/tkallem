import logging
from dataclasses import dataclass
from functools import lru_cache

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings

logger = logging.getLogger(__name__)

_bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class ClerkClaims:
    user_id: str
    session_id: str | None


@lru_cache
def _jwks_client() -> jwt.PyJWKClient:
    return jwt.PyJWKClient(settings.clerk_jwks_url, cache_keys=True, lifespan=3600, timeout=5)


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def verify_clerk_token(token: str) -> ClerkClaims:
    if not settings.clerk_jwks_url or not settings.clerk_issuer:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Authentication is not configured")

    try:
        signing_key = _jwks_client().get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=settings.clerk_issuer,
            options={"require": ["exp", "nbf", "iat", "iss", "sub"]},
            leeway=5,
        )
    except jwt.PyJWKClientConnectionError:
        logger.exception("Could not reach Clerk JWKS endpoint")
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Authentication service unavailable")
    except (jwt.PyJWKClientError, jwt.InvalidTokenError) as exc:
        logger.warning("Rejected token: %s", exc)
        raise _unauthorized("Invalid or expired token")

    azp = claims.get("azp")
    if azp and azp.rstrip("/") not in settings.allowed_frontend_origins:
        logger.warning("Rejected token from unexpected origin: %s", azp)
        raise _unauthorized("Invalid or expired token")

    return ClerkClaims(user_id=claims["sub"], session_id=claims.get("sid"))


def get_clerk_claims(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> ClerkClaims:
    if credentials is None:
        raise _unauthorized("Missing bearer token")
    return verify_clerk_token(credentials.credentials)