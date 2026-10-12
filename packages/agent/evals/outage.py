"""A provider outage is not an answer from the model. An eval case that hits one (5xx, 429, timeout, connection lost)
runs again after a pause, at most 3 times in all; if the provider is still down, the case fails as before.
A wrong or unparseable answer is never retried here: it counts against the model."""
import time

WAITS = (15, 45)  # seconds before the 2nd and the 3rd try
_NETWORK = {"APITimeoutError", "APIConnectionError", "ConnectTimeout", "ReadTimeout", "ConnectError", "RemoteProtocolError"}


def provider_down(e: BaseException | None) -> bool:
    """True if the error, or one it was raised from, says the provider did not answer."""
    seen: set[int] = set()
    while e is not None and id(e) not in seen:
        seen.add(id(e))
        status = getattr(e, "status_code", None)
        if isinstance(status, int) and (status >= 500 or status == 429):
            return True
        if isinstance(e, (TimeoutError, ConnectionError)) or type(e).__name__ in _NETWORK:
            return True
        e = e.__cause__ or e.__context__
    return False


def retry_outage(label: str, fn, waits=WAITS, sleep=time.sleep):
    """fn() again after each wait while the provider is down; any other error, or the last outage, is raised."""
    for wait in (*waits, None):
        try:
            return fn()
        except Exception as e:
            if wait is None or not provider_down(e):
                raise
            print(f"{label}: provider unavailable ({type(e).__name__}), trying again in {wait} s", flush=True)
            sleep(wait)
