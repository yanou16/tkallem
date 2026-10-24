"""A provider outage is not an answer from the model. An eval case that hits one (5xx, 429, timeout, connection lost)
runs again after a pause, at most 3 times in all; if the provider is still down, the case fails as before.
Upstream-provider 404 errors are retried too; explicit unknown-model 404 errors are not.
If the coach kept only the provider exception class, retry at most twice, then fail normally.
A wrong or unparseable answer is never retried here: it counts against the model."""
import re
import time

WAITS = (15, 45)  # seconds before the 2nd and the 3rd try
_NETWORK = {"APITimeoutError", "APIConnectionError", "ConnectTimeout", "ReadTimeout", "ConnectError", "RemoteProtocolError"}
# The coach node turns a provider error into "no usable output (OpenAIAPIError)" and the turn fails without the error
# attached: the class name in the message is all that is left of it.
_SWALLOWED = re.compile(r"no usable output \((OpenAIAPIError|InternalServerError|APIStatusError|RateLimitError|"
                        r"APITimeoutError|APIConnectionError|OpenAIModelNotFoundError)\)")


def provider_down(e: BaseException | None) -> bool:
    """True if the error, or one it was raised from, says the provider did not answer."""
    seen: set[int] = set()
    while e is not None and id(e) not in seen:
        seen.add(id(e))
        status = getattr(e, "status_code", None)
        # OpenRouter also returns 404 when a selected upstream host is unavailable.
        # A genuinely unknown model or invalid route must still fail immediately.
        if status == 404 and "provider returned error" in str(e).lower():
            return True
        if isinstance(status, int) and (status >= 500 or status == 429):
            return True
        if isinstance(e, (TimeoutError, ConnectionError)) or type(e).__name__ in _NETWORK:
            return True
        if _SWALLOWED.search(str(e)):
            return True
        e = e.__cause__ or e.__context__
    return False


def retry_outage(label: str, fn, waits=WAITS, sleep=time.sleep):
    """fn() again after each wait while the provider is down; any other error, or the last outage, is raised."""
    for wait in (*waits, None):
        try:
            result = fn()
            # LangGraph may return a failed state rather than raise. Treat the
            # same upstream error consistently in both representations.
            if isinstance(result, dict) and result.get("turn") is None and result.get("error"):
                error = RuntimeError(str(result["error"]))
                if provider_down(error):
                    raise error
            return result
        except Exception as e:
            if wait is None or not provider_down(e):
                raise
            print(f"{label}: provider unavailable ({type(e).__name__}), trying again in {wait} s", flush=True)
            sleep(wait)
