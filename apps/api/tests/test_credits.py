"""Credits and guest mode, on a real Postgres (the `db` fixture). `now` is injected to cross day boundaries."""
import threading
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import psycopg
import pytest
from psycopg.rows import dict_row

from app import credits, guests
from app.config import settings
from app.db.users import get_by_clerk_id, get_or_create_by_clerk_id
from app.db.sessions import create_session

T0 = datetime(2026, 10, 12, 10, 0, tzinfo=timezone.utc)
DAY = timedelta(days=1)


@pytest.fixture(autouse=True)
def secret(monkeypatch):
    monkeypatch.setattr(settings, "guest_secret", "x" * 48)
    monkeypatch.setattr(settings, "budget_cache_s", 0)  # exact budget in tests
    monkeypatch.setattr(settings, "daily_spend_cap", 100000)


def student(db, name="user_credit_a"):
    return get_or_create_by_clerk_id(db, name)


def balance(db, user):
    return db.execute("SELECT balance FROM credit_wallets WHERE user_id = %s", (user["id"],)).fetchone()["balance"]


def ledger(db, user):
    return [(r["reason"], r["delta"], r["balance_after"]) for r in
            db.execute("SELECT reason, delta, balance_after FROM credit_ledger WHERE user_id = %s ORDER BY id", (user["id"],))]


# ---- starting credits ------------------------------------------------------------------------------------------

def test_guest_starts_with_40_credits_and_never_refills(db):
    user, token = credits.create_guest(db, "10.0.0.1", T0)
    assert credits.is_guest(user) and balance(db, user) == settings.guest_credits
    assert credits.status(db, user, T0 + 5 * DAY).balance == settings.guest_credits  # no daily credits for guests
    assert credits.status(db, user, T0).next_refill_at is None
    assert ledger(db, user) == [("guest_grant", settings.guest_credits, settings.guest_credits)]


def test_signed_in_student_gets_60_once(db):
    user = student(db)
    assert credits.status(db, user, T0).balance == 60
    assert credits.status(db, user, T0).balance == 60  # asking again grants nothing
    assert ledger(db, user) == [("login_bonus", 60, 60)]


# ---- daily refill ----------------------------------------------------------------------------------------------

def test_refill_is_lazy_capped_and_cumulative(db):
    user = student(db)
    assert credits.status(db, user, T0).balance == 60            # welcome bonus, above the cap of 45
    for _ in range(30):
        credits.spend(db, user, now=T0)                          # 60 -> 30
    assert credits.status(db, user, T0).balance == 30            # same day: no refill
    assert credits.status(db, user, T0 + DAY).balance == 45      # next day: +15
    assert credits.status(db, user, T0 + DAY).balance == 45      # asking again the same day adds nothing
    assert [r for r in ledger(db, user) if r[0] == "daily_refill"] == [("daily_refill", 15, 45)]


def test_no_refill_while_the_balance_is_above_the_cap(db):
    user = student(db, "user_credit_above")
    assert credits.status(db, user, T0).balance == 60
    assert credits.status(db, user, T0 + 3 * DAY).balance == 60  # 60 >= 45: nothing to add, the bonus is kept


def test_refill_after_a_long_absence_stops_at_the_cap(db):
    user = student(db, "user_credit_b")
    credits.status(db, user, T0)
    for _ in range(60):
        credits.spend(db, user, now=T0)
    assert balance(db, user) == 0
    assert credits.status(db, user, T0 + 20 * DAY).balance == 45  # 20 days x 15 would be 300: capped
    assert credits.status(db, user, T0 + DAY).next_refill_at == datetime(2026, 10, 14, tzinfo=timezone.utc)


# ---- spending --------------------------------------------------------------------------------------------------

def test_spend_never_goes_below_zero_and_reports_when_to_come_back(db):
    user = student(db, "user_credit_c")
    credits.status(db, user, T0)
    for _ in range(60):
        credits.spend(db, user, now=T0)
    with pytest.raises(credits.NoCredits) as e:
        credits.spend(db, user, now=T0)
    assert balance(db, user) == 0 and e.value.next_refill_at == datetime(2026, 10, 13, tzinfo=timezone.utc)


def test_guest_without_credits_has_no_return_date(db):
    guest, _ = credits.create_guest(db, "10.0.0.2", T0)
    for _ in range(settings.guest_credits):
        credits.spend(db, guest, now=T0)
    with pytest.raises(credits.NoCredits) as e:
        credits.spend(db, guest, now=T0)
    assert e.value.next_refill_at is None  # a guest must sign in


def test_refund_gives_the_credit_back_and_is_logged(db):
    user = student(db, "user_credit_d")
    sid = uuid4()
    credits.spend(db, user, sid, T0)
    credits.refund(db, user, sid)
    assert balance(db, user) == 60
    assert [r[:2] for r in ledger(db, user)] == [("login_bonus", 60), ("turn_spent", -1), ("refund", 1)]


def test_global_daily_budget_stops_everyone_and_resets_tomorrow(db, monkeypatch):
    now = datetime.now(timezone.utc)  # the ledger is stamped by the database clock, so this test uses the real one
    a, b = student(db, "user_budget_a"), student(db, "user_budget_b")
    credits.status(db, a, now), credits.status(db, b, now)
    monkeypatch.setattr(settings, "daily_spend_cap", credits.spent_today(db, now) + 2)
    credits.spend(db, a, now=now)
    credits.spend(db, b, now=now)
    with pytest.raises(credits.DailyBudgetReached):
        credits.spend(db, a, now=now)
    credits.refund(db, a, None)                          # a refund frees one unit of today's budget
    credits.spend(db, b, now=now)
    with pytest.raises(credits.DailyBudgetReached):
        credits.spend(db, a, now=now)
    db.execute("UPDATE credit_ledger SET created_at = created_at - interval '2 days'")
    credits.spend(db, a, now=now)                        # yesterday's spending no longer counts


# ---- guest tokens and limits -----------------------------------------------------------------------------------

def test_guest_token_is_signed_and_tamper_proof():
    gid = guests.new_guest_id()
    token = guests.issue(gid)
    assert guests.verify(token) == gid
    assert guests.verify(token[:-1] + ("0" if token[-1] != "0" else "1")) is None  # one character changed
    assert guests.verify(f"g1.{guests.new_guest_id()}.{token.rsplit('.', 1)[1]}") is None  # signature of another guest
    for junk in ("", "g1.x.y", "Bearer abc", token.upper(), None):
        assert guests.verify(junk) is None


def test_token_from_another_secret_is_rejected(monkeypatch):
    token = guests.issue(guests.new_guest_id())
    monkeypatch.setattr(settings, "guest_secret", "y" * 48)
    assert guests.verify(token) is None


def test_guest_mode_needs_a_real_secret(monkeypatch, db):
    monkeypatch.setattr(settings, "guest_secret", "short")
    assert guests.verify(guests.issue.__module__ and "g1." + "a" * 32 + "." + "b" * 64) is None
    with pytest.raises(guests.GuestsDisabled):
        credits.create_guest(db, "10.0.0.3", T0)


def test_guests_per_address_are_capped_and_the_address_is_not_stored(db, monkeypatch):
    monkeypatch.setattr(settings, "guest_ip_daily_cap", 2)
    # The real clock, like test_total_guests_per_day_are_capped: users.created_at is the database's now(), so a fixed
    # date made "the next day" fail once the real day passed the fixed one (CI broke on 13 October at 10:00 UTC).
    now = datetime.now(timezone.utc)
    credits.create_guest(db, "10.0.0.9", now)
    credits.create_guest(db, "10.0.0.9", now)
    with pytest.raises(credits.GuestLimit):
        credits.create_guest(db, "10.0.0.9", now)
    credits.create_guest(db, "10.0.0.10", now)              # another address is fine
    credits.create_guest(db, "10.0.0.9", now + 2 * DAY)     # the next day too
    stored = [r["guest_ip_hash"] for r in db.execute("SELECT guest_ip_hash FROM users WHERE guest_ip_hash IS NOT NULL")]
    assert stored and all("10.0.0" not in h for h in stored)


def test_total_guests_per_day_are_capped(db, monkeypatch):
    base = db.execute("SELECT count(*) AS n FROM users WHERE guest_ip_hash IS NOT NULL").fetchone()["n"]
    monkeypatch.setattr(settings, "guest_daily_cap", base + 1)
    credits.create_guest(db, "10.1.0.1", datetime.now(timezone.utc))
    with pytest.raises(credits.GuestLimit):
        credits.create_guest(db, "10.1.0.2", datetime.now(timezone.utc))


# ---- claiming a guest after sign-in ---------------------------------------------------------------------------

def test_claim_moves_credits_once_and_sessions(db):
    guest, token = credits.create_guest(db, "10.0.2.1", T0)
    for _ in range(10):
        credits.spend(db, guest, now=T0)                    # guest_credits - 10 left
    sid = uuid4()
    create_session(db, sid, guest["id"], "visa-us", "text", "fr", {"turns": []})
    user = student(db, "user_claim_a")
    left = settings.guest_credits - 10
    assert credits.claim_guest(db, token, user, T0) == left
    assert balance(db, user) == settings.login_bonus + left and balance(db, guest) == 0
    assert db.execute("SELECT user_id FROM practice_sessions WHERE id = %s", (sid,)).fetchone()["user_id"] == user["id"]
    assert credits.claim_guest(db, token, user, T0) == 0    # replaying the token gives nothing
    assert balance(db, user) == settings.login_bonus + left


def test_a_user_can_claim_credits_only_once_even_with_new_guests(db):
    user = student(db, "user_claim_b")
    _, t1 = credits.create_guest(db, "10.0.2.2", T0)
    _, t2 = credits.create_guest(db, "10.0.2.3", T0)
    assert credits.claim_guest(db, t1, user, T0) == settings.guest_credits
    assert credits.claim_guest(db, t2, user, T0) == 0       # farming guests into one account does not work
    assert balance(db, user) == settings.login_bonus + settings.guest_credits


def test_claim_rejects_forged_tokens(db):
    with pytest.raises(credits.InvalidGuestToken):
        credits.claim_guest(db, "g1." + "a" * 32 + "." + "b" * 64, student(db, "user_claim_c"), T0)


def test_a_claimed_guest_token_cannot_mint_new_credits(db):
    guest, token = credits.create_guest(db, "10.0.2.4", T0)
    user = student(db, "user_claim_d")
    credits.claim_guest(db, token, user, T0)
    again = get_by_clerk_id(db, guests.clerk_id(guests.verify(token)))
    assert again["id"] == guest["id"] and credits.status(db, again, T0).balance == 0


# ---- concurrency: real separate connections --------------------------------------------------------------------

def test_ten_simultaneous_answers_spend_exactly_the_credits_available():
    if not settings.test_database_url:
        pytest.skip("TEST_DATABASE_URL is not set")
    name = f"user_race_{uuid4().hex[:8]}"
    url = settings.test_database_url
    with psycopg.connect(url, row_factory=dict_row) as setup:
        user = get_or_create_by_clerk_id(setup, name)
        credits.ensure_wallet(setup, user, T0)
        setup.execute("UPDATE credit_wallets SET balance = 3 WHERE user_id = %s", (user["id"],))
        setup.commit()
    results, barrier = [], threading.Barrier(10)

    def worker():
        with psycopg.connect(url, row_factory=dict_row) as conn:
            barrier.wait()
            try:
                credits.spend(conn, user, now=T0)
                conn.commit()
                results.append("ok")
            except credits.NoCredits:
                conn.rollback()
                results.append("refused")

    try:
        threads = [threading.Thread(target=worker) for _ in range(10)]
        [t.start() for t in threads]
        [t.join() for t in threads]
        with psycopg.connect(url, row_factory=dict_row) as check:
            final = check.execute("SELECT balance FROM credit_wallets WHERE user_id = %s", (user["id"],)).fetchone()["balance"]
        assert results.count("ok") == 3 and results.count("refused") == 7 and final == 0
    finally:
        with psycopg.connect(url) as cleanup:
            cleanup.execute("DELETE FROM users WHERE id = %s", (user["id"],))
            cleanup.commit()


def test_guest_starts_at_b1(db):
    user, _ = credits.create_guest(db, "9.9.9.9")
    assert user["level"] == "B1"


class _Now:
    """threading.Thread stand-in that runs the target at once, so the webhook call can be checked."""

    def __init__(self, target, args=(), daemon=None):
        self.target, self.args = target, args

    def start(self):
        self.target(*self.args)


def test_budget_alert_fires_once_near_the_cap_and_once_when_reached(db, monkeypatch):
    sent = []
    monkeypatch.setattr(credits, "_alerted", {"near": None, "reached": None})
    monkeypatch.setattr(credits.threading, "Thread", _Now)
    monkeypatch.setattr(credits, "_post_alert", sent.append)
    monkeypatch.setattr(settings, "alert_webhook_url", "https://hooks.example/alert")
    monkeypatch.setattr(settings, "budget_alert_ratio", 0.8)
    now = datetime.now(timezone.utc)
    monkeypatch.setattr(settings, "daily_spend_cap", credits.spent_today(db, now) + 5)
    a = student(db, "user_alert_a")

    for _ in range(3):                                  # 3 of 5: below 80 %
        credits.spend(db, a, None, now)
    assert sent == []
    credits.spend(db, a, None, now)                    # 4 of 5 = 80 %: one warning
    credits.spend(db, a, None, now)                    # 5 of 5: no second "near" warning
    assert len(sent) == 1 and "4 of" in sent[0]
    with pytest.raises(credits.DailyBudgetReached):    # over the cap: one "used up" warning, then silence
        credits.spend(db, a, None, now)
    with pytest.raises(credits.DailyBudgetReached):
        credits.spend(db, a, None, now)
    assert len(sent) == 2 and "used up" in sent[1]


def test_budget_alert_without_webhook_only_logs(db, monkeypatch, caplog):
    monkeypatch.setattr(credits, "_alerted", {"near": None, "reached": None})
    monkeypatch.setattr(settings, "alert_webhook_url", "")
    monkeypatch.setattr(credits, "_post_alert", lambda text: (_ for _ in ()).throw(AssertionError("no webhook")))
    now = datetime.now(timezone.utc)
    monkeypatch.setattr(settings, "daily_spend_cap", credits.spent_today(db, now) + 1)
    with caplog.at_level("WARNING"):
        credits.spend(db, student(db, "user_alert_b"), None, now)
    assert any("credits spent today" in r.message for r in caplog.records)
