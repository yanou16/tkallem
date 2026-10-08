import time
from types import SimpleNamespace

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException

from app import security
from app.config import settings

ISSUER = "https://test.clerk.accounts.dev"
ORIGIN = "http://localhost:3000"

_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
_other_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture(autouse=True)
def fake_clerk(monkeypatch):
    monkeypatch.setattr(settings, "clerk_jwks_url", "https://test.invalid/jwks.json")
    monkeypatch.setattr(settings, "clerk_issuer", ISSUER)
    monkeypatch.setattr(settings, "frontend_origin", ORIGIN)
    fake_client = SimpleNamespace(
        get_signing_key_from_jwt=lambda token: SimpleNamespace(key=_key.public_key())
    )
    monkeypatch.setattr(security, "_jwks_client", lambda: fake_client)


def make_token(key=_key, algorithm="RS256", drop=(), **overrides):
    now = int(time.time())
    claims = {
        "iss": ISSUER,
        "sub": "user_123",
        "sid": "sess_456",
        "azp": ORIGIN,
        "iat": now,
        "nbf": now,
        "exp": now + 60,
    }
    claims.update(overrides)
    for name in drop:
        claims.pop(name)
    return jwt.encode(claims, key, algorithm=algorithm)


def test_valid_token_returns_claims():
    claims = security.verify_clerk_token(make_token())
    assert claims.user_id == "user_123"
    assert claims.session_id == "sess_456"


BAD_TOKENS = {
    "expired": lambda: make_token(exp=int(time.time()) - 60),
    "wrong_issuer": lambda: make_token(iss="https://evil.example"),
    "wrong_origin": lambda: make_token(azp="https://evil.example"),
    "signed_with_other_key": lambda: make_token(key=_other_key),
    "hs256_algorithm": lambda: make_token(key="x" * 32, algorithm="HS256"),
    "missing_exp": lambda: make_token(drop=("exp",)),
    "not_a_jwt": lambda: "not-a-jwt",
}


@pytest.mark.parametrize("build", BAD_TOKENS.values(), ids=BAD_TOKENS.keys())
def test_bad_tokens_are_rejected(build):
    with pytest.raises(HTTPException) as exc:
        security.verify_clerk_token(build())
    assert exc.value.status_code == 401


def test_missing_bearer_is_rejected():
    with pytest.raises(HTTPException) as exc:
        security.get_clerk_claims(None)
    assert exc.value.status_code == 401


def test_unconfigured_auth_returns_503(monkeypatch):
    monkeypatch.setattr(settings, "clerk_jwks_url", "")
    with pytest.raises(HTTPException) as exc:
        security.verify_clerk_token(make_token())
    assert exc.value.status_code == 503
