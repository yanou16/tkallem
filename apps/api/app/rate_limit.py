"""Per-student rate limits, kept in memory (one API process).

The routes only call `limiter.allow(key)`: moving to Redis later only changes this module.
# TODO: Redis (shared counters when the API runs on several processes or servers)
"""
import threading
import time
from collections import deque


class RateLimiter:
    """At most `limit` hits per `window_seconds`, per key (a sliding window: the last N seconds, not a calendar slot)."""

    def __init__(self, limit: int, window_seconds: float, clock=time.monotonic):
        self.limit = limit
        self.window_seconds = window_seconds
        self._clock = clock
        self._hits: dict[str, deque[float]] = {}
        self._lock = threading.Lock()  # sync routes run in a thread pool: two requests can arrive at once

    def allow(self, key: str) -> bool:
        """Counts this hit and returns True, or returns False (nothing counted) when the limit is reached."""
        now = self._clock()
        with self._lock:
            hits = self._hits.setdefault(key, deque())
            while hits and now - hits[0] >= self.window_seconds:
                hits.popleft()  # older than the window: forgotten
            if len(hits) >= self.limit:
                return False
            hits.append(now)
            return True

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


explain_notes = RateLimiter(limit=10, window_seconds=3600)  # report notes written again in the other language, per student and per hour
phrase_checks = RateLimiter(limit=15, window_seconds=3600)  # recordings of the phrase of the day per student and per hour (each one is a paid transcription)
group_messages = RateLimiter(limit=20, window_seconds=60)  # messages per student and per minute
group_checks = RateLimiter(limit=30, window_seconds=24 * 3600)  # private checks per student over 24 hours (phase 4)
