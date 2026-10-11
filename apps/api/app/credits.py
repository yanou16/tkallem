"""Credits: 1 credit = 1 answer from the student (docs/CREDITS.md).

Every balance change goes through `_apply`, which updates the wallet and writes the ledger line in one statement
group, so the two can never disagree. A debit is a single conditional UPDATE (`balance + delta >= 0`): two answers sent
at the same moment cannot spend the same credit. Grants carry a `ref` (unique per user), so replaying one is harmless.

The functions take an open connection and never commit: the caller decides the transaction. `now` is a parameter so
the day boundaries can be tested.
"""
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from uuid import UUID

import psycopg
from psycopg import Connection

from app import guests
from app.config import settings
from app.db.users import get_by_clerk_id


class NoCredits(Exception):
    def __init__(self, next_refill_at: datetime | None):
        super().__init__("no credits left")
        self.next_refill_at = next_refill_at


class DailyBudgetReached(Exception):
    """Everyone together spent today's credit budget: the free practice resumes tomorrow."""


class GuestLimit(Exception):
    """Too many guest accounts created from this address (or in total) today."""


class InvalidGuestToken(Exception):
    pass


@dataclass
class CreditStatus:
    balance: int
    is_guest: bool
    next_refill_at: datetime | None  # None for guests: they get no daily credits, they must sign in

    def as_dict(self) -> dict:
        return {"balance": self.balance, "next_refill_at": self.next_refill_at}


def _utc(now: datetime | None) -> datetime:
    return (now or datetime.now(timezone.utc)).astimezone(timezone.utc)


def _midnight_after(day: date) -> datetime:
    return datetime.combine(day + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc)


def _wallet(conn: Connection, user_id: int, lock: bool = False) -> dict | None:
    return conn.execute(
        "SELECT balance, last_refill_on FROM credit_wallets WHERE user_id = %s" + (" FOR UPDATE" if lock else ""),
        (user_id,),
    ).fetchone()


def _apply(conn: Connection, user_id: int, delta: int, reason: str, *, ref: str | None = None, session_id: UUID | None = None) -> int | None:
    """Add `delta` to the wallet and log it. Returns the new balance, or None when nothing was applied: the balance
    would go below zero, or a line with the same `ref` already exists."""
    try:
        with conn.transaction():  # a savepoint: a duplicate ref undoes the balance change too
            row = conn.execute(
                "UPDATE credit_wallets SET balance = balance + %s WHERE user_id = %s AND balance + %s >= 0 RETURNING balance",
                (delta, user_id, delta),
            ).fetchone()
            if row is None:
                return None
            conn.execute(
                "INSERT INTO credit_ledger (user_id, delta, reason, balance_after, session_id, ref) VALUES (%s, %s, %s, %s, %s, %s)",
                (user_id, delta, reason, row["balance"], session_id, ref),
            )
            return row["balance"]
    except psycopg.errors.UniqueViolation:
        return None


def is_guest(user: dict) -> bool:
    return guests.is_guest_clerk_id(user["clerk_user_id"])


def ensure_wallet(conn: Connection, user: dict, now: datetime | None = None) -> None:
    """Create the wallet on first use and give the starting credits once (guests: 40, signed-in students: 60)."""
    today = _utc(now).date()
    created = conn.execute(
        "INSERT INTO credit_wallets (user_id, balance, last_refill_on) VALUES (%s, 0, %s) ON CONFLICT (user_id) DO NOTHING RETURNING user_id",
        (user["id"], today),
    ).fetchone()
    if created:
        if is_guest(user):
            _apply(conn, user["id"], settings.guest_credits, "guest_grant", ref="guest_grant")
        else:
            _apply(conn, user["id"], settings.login_bonus, "login_bonus", ref="login_bonus")


def refill(conn: Connection, user: dict, now: datetime | None = None) -> None:
    """Lazy daily refill for signed-in students: +daily_refill per day since the last visit, never above refill_cap."""
    if is_guest(user):
        return
    today = _utc(now).date()
    wallet = _wallet(conn, user["id"], lock=True)
    days = (today - (wallet["last_refill_on"] or today)).days
    if days <= 0:
        return
    add = min(days * settings.daily_refill, max(0, settings.refill_cap - wallet["balance"]))
    if add > 0:
        _apply(conn, user["id"], add, "daily_refill", ref=f"refill:{today.isoformat()}")
    conn.execute("UPDATE credit_wallets SET last_refill_on = %s WHERE user_id = %s", (today, user["id"]))


def status(conn: Connection, user: dict, now: datetime | None = None) -> CreditStatus:
    ensure_wallet(conn, user, now)
    refill(conn, user, now)
    balance = _wallet(conn, user["id"])["balance"]
    guest = is_guest(user)
    return CreditStatus(balance, guest, None if guest else _midnight_after(_utc(now).date()))


def spent_today(conn: Connection, now: datetime | None = None) -> int:
    """Credits spent by everybody since midnight UTC (refunds deducted)."""
    day_start = datetime.combine(_utc(now).date(), datetime.min.time(), tzinfo=timezone.utc)
    return conn.execute(
        "SELECT COALESCE(-SUM(delta), 0) AS n FROM credit_ledger WHERE reason IN ('turn_spent', 'refund') AND created_at >= %s",
        (day_start,),
    ).fetchone()["n"]


def spend(conn: Connection, user: dict, session_id: UUID | None = None, now: datetime | None = None) -> CreditStatus:
    """Take one credit before the paid providers are called. Raises NoCredits or DailyBudgetReached."""
    current = status(conn, user, now)
    if spent_today(conn, now) >= settings.daily_spend_cap:
        raise DailyBudgetReached()
    balance = _apply(conn, user["id"], -1, "turn_spent", session_id=session_id)
    if balance is None:
        raise NoCredits(current.next_refill_at)
    return CreditStatus(balance, current.is_guest, current.next_refill_at)


def refund(conn: Connection, user: dict, session_id: UUID | None = None) -> None:
    """Give the credit back when the answer could not be processed: a student never pays for an outage."""
    _apply(conn, user["id"], +1, "refund", session_id=session_id)


def create_guest(conn: Connection, ip: str, now: datetime | None = None) -> tuple[dict, str]:
    """A new guest account (row in users + 40 credits). Returns (user, token). Raises GuestLimit."""
    since = _utc(now) - timedelta(days=1)
    ip_hash = guests.hash_ip(ip)
    by_ip = conn.execute("SELECT count(*) AS n FROM users WHERE guest_ip_hash = %s AND created_at >= %s", (ip_hash, since)).fetchone()["n"]
    total = conn.execute("SELECT count(*) AS n FROM users WHERE guest_ip_hash IS NOT NULL AND created_at >= %s", (since,)).fetchone()["n"]
    if by_ip >= settings.guest_ip_daily_cap or total >= settings.guest_daily_cap:
        raise GuestLimit()
    guest_id = guests.new_guest_id()
    user = conn.execute(
        "INSERT INTO users (clerk_user_id, guest_ip_hash, level) VALUES (%s, %s, 'B1') RETURNING id, clerk_user_id, email, first_name, level, explain_lang, created_at",
        (guests.clerk_id(guest_id), ip_hash),
    ).fetchone()
    ensure_wallet(conn, user, now)
    return user, guests.issue(guest_id)


def claim_guest(conn: Connection, token: str, user: dict, now: datetime | None = None) -> int:
    """After sign-in: move the guest's sessions to the account and add the guest's remaining credits once.
    Returns the credits transferred. The guest row stays (empty), so its token cannot be replayed for new credits."""
    guest_id = guests.verify(token)
    if guest_id is None:
        raise InvalidGuestToken()
    guest = get_by_clerk_id(conn, guests.clerk_id(guest_id))
    if guest is None or guest["id"] == user["id"]:
        return 0
    ensure_wallet(conn, user, now)
    ensure_wallet(conn, guest, now)
    with conn.transaction():
        first, second = sorted((user["id"], guest["id"]))  # same lock order everywhere: no deadlock
        _wallet(conn, first, lock=True)
        _wallet(conn, second, lock=True)
        amount = _wallet(conn, guest["id"])["balance"]
        moved = 0
        if amount > 0 and _apply(conn, user["id"], amount, "guest_transfer", ref="guest_claim") is not None:
            _apply(conn, guest["id"], -amount, "guest_transfer", ref=f"claimed_by:{user['id']}")
            moved = amount
        conn.execute("UPDATE practice_sessions SET user_id = %s WHERE user_id = %s", (user["id"], guest["id"]))
    return moved
