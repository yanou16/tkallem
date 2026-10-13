from app.rate_limit import RateLimiter, group_checks, group_messages


class FakeClock:
    def __init__(self):
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


def test_allows_up_to_the_limit_then_refuses():
    limiter = RateLimiter(limit=3, window_seconds=60, clock=FakeClock())

    assert [limiter.allow("amina") for _ in range(4)] == [True, True, True, False]


def test_a_refused_hit_is_not_counted_and_the_window_slides():
    clock = FakeClock()
    limiter = RateLimiter(limit=2, window_seconds=60, clock=clock)
    limiter.allow("amina")
    clock.now += 30
    limiter.allow("amina")
    assert limiter.allow("amina") is False

    clock.now += 31  # the first hit is now older than 60 s

    assert limiter.allow("amina") is True
    assert limiter.allow("amina") is False


def test_each_student_has_her_own_counter():
    limiter = RateLimiter(limit=1, window_seconds=60, clock=FakeClock())

    assert limiter.allow("amina") is True
    assert limiter.allow("yacine") is True
    assert limiter.allow("amina") is False


def test_reset_forgets_everything():
    limiter = RateLimiter(limit=1, window_seconds=60, clock=FakeClock())
    limiter.allow("amina")

    limiter.reset()

    assert limiter.allow("amina") is True


def test_group_limits():
    assert (group_messages.limit, group_messages.window_seconds) == (20, 60)
    assert (group_checks.limit, group_checks.window_seconds) == (30, 24 * 3600)
