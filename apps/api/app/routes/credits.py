"""Guest mode and credits (docs/CREDITS.md)."""
import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from psycopg import Connection

from app import credits, guests
from app.config import settings
from app.db.connection import get_conn
from app.dependencies import get_current_user
from app.schemas.credits import ClaimGuest, Claimed, Credits, GuestCreated

logger = logging.getLogger(__name__)
router = APIRouter(tags=["credits"])


def client_ip(request: Request) -> str:
    """The student's network address. Behind a reverse proxy (Render, Railway: 1 hop) the socket address is the
    proxy's, so the proxy's header is used: the entry added by the LAST trusted proxy, which the client cannot forge."""
    hops = settings.forwarded_hops
    forwarded = [p.strip() for p in request.headers.get("x-forwarded-for", "").split(",") if p.strip()]
    if hops > 0 and len(forwarded) >= hops:
        return forwarded[-hops]
    return request.client.host if request.client else "unknown"


@router.post("/guests", response_model=GuestCreated, status_code=status.HTTP_201_CREATED)
def create_guest(request: Request, conn: Connection = Depends(get_conn)) -> dict:
    """A visitor without account gets a signed token and the guest credits. Rate limited per address and per day."""
    try:
        user, token = credits.create_guest(conn, client_ip(request))
    except guests.GuestsDisabled:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Guest mode is not enabled")
    except credits.GuestLimit:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, detail={"code": "guest_limit", "message": "Too many visitors from this network today, please sign in"})
    return {"guest_token": token, "credits": credits.status(conn, user).as_dict()}


@router.get("/me/credits", response_model=Credits)
def read_credits(user: dict = Depends(get_current_user), conn: Connection = Depends(get_conn)) -> dict:
    return credits.status(conn, user).as_dict()


@router.post("/me/claim-guest", response_model=Claimed)
def claim_guest(body: ClaimGuest, user: dict = Depends(get_current_user), conn: Connection = Depends(get_conn)) -> dict:
    """Right after sign-in: bring the guest's sessions and remaining credits to the account (credits: once)."""
    if credits.is_guest(user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Sign in first")
    try:
        transferred = credits.claim_guest(conn, body.guest_token, user)
    except credits.InvalidGuestToken:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Invalid guest token")
    return {"transferred": transferred, "credits": credits.status(conn, user).as_dict()}
