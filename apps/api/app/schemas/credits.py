from datetime import datetime

from pydantic import BaseModel, ConfigDict


class Credits(BaseModel):
    balance: int
    next_refill_at: datetime | None = None  # null for guests: signing in gives daily credits


class GuestCreated(BaseModel):
    guest_token: str
    credits: Credits


class ClaimGuest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    guest_token: str


class Claimed(BaseModel):
    transferred: int
    credits: Credits
