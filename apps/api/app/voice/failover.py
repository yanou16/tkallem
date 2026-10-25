"""Backup chain for the voice providers: when one is rate limited, out of balance or down, the next one answers, and the
failing one is skipped for a few minutes instead of being retried (and slowing down) on every turn."""
import logging
import threading
import time

logger = logging.getLogger(__name__)
_down_until: dict[tuple[str, str], float] = {}
_soft_failures: dict[tuple[str, str], int] = {}  # failures in a row without a success (timeouts, outages): the rest grows
_lock = threading.Lock()

# Limits that do not clear in seconds (daily quota, empty balance, terms not accepted, bad key): rest the provider longer.
HARD_STATUSES = {400, 401, 402, 403, 429}
HARD_COOLDOWN_S = 300.0
SOFT_COOLDOWN_S = 20.0  # outage, timeout, 5xx: the first rest; 3 times longer for each failure in a row, up to HARD_COOLDOWN_S


def names(setting: str) -> list[str]:
    return [n.strip().lower() for n in setting.split(",") if n.strip()]


def ordered(kind: str, providers: list[str], now: float | None = None) -> list[str]:
    """Healthy providers first, in the configured order; the resting ones stay at the end as a last resort."""
    now = time.monotonic() if now is None else now
    with _lock:
        healthy = [p for p in providers if _down_until.get((kind, p), 0) <= now]
    return healthy + [p for p in providers if p not in healthy]


def mark_down(kind: str, provider: str, status: int | None, now: float | None = None) -> None:
    now = time.monotonic() if now is None else now
    with _lock:
        if status in HARD_STATUSES:
            seconds = HARD_COOLDOWN_S
        else:
            _soft_failures[(kind, provider)] = _soft_failures.get((kind, provider), 0) + 1
            # 20 s, 60 s, 180 s, 300 s: a provider that keeps timing out (DeepInfra at busy hours) stops costing a wait every 20 s
            seconds = min(HARD_COOLDOWN_S, SOFT_COOLDOWN_S * 3 ** (_soft_failures[(kind, provider)] - 1))
        _down_until[(kind, provider)] = now + seconds
    logger.warning("%s provider %s resting for %.0f s (status %s)", kind, provider, seconds, status)


def mark_ok(kind: str, provider: str) -> None:
    with _lock:
        _down_until.pop((kind, provider), None)
        _soft_failures.pop((kind, provider), None)


def reset() -> None:
    with _lock:
        _down_until.clear()
        _soft_failures.clear()
