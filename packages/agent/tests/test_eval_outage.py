import sys
from pathlib import Path

import httpx
import openai
import pytest

sys.path.insert(0, str(Path(__file__).parents[1] / "evals"))
from outage import provider_down, retry_outage  # noqa: E402

REQUEST = httpx.Request("POST", "https://openrouter.ai/api/v1/chat/completions")


def status_error(code: int) -> openai.APIStatusError:
    return openai.APIStatusError("error", response=httpx.Response(code, request=REQUEST), body=None)


def test_provider_outages_are_recognised():
    assert provider_down(status_error(504))
    assert provider_down(status_error(429))
    assert provider_down(openai.APITimeoutError(request=REQUEST))
    assert provider_down(TimeoutError())


def test_answers_and_client_errors_are_not_outages():
    assert not provider_down(status_error(400))
    assert not provider_down(status_error(401))
    assert not provider_down(ValueError("invalid JSON from the model"))


def test_an_outage_wrapped_by_the_agent_is_recognised():
    class AgentError(RuntimeError):
        pass

    try:
        try:
            raise status_error(504)
        except openai.APIStatusError as e:
            raise AgentError("agent call failed") from e
    except AgentError as wrapped:
        assert provider_down(wrapped)


def test_retries_an_outage_then_returns_the_answer():
    calls, waits = [], []

    def fn():
        calls.append(1)
        if len(calls) < 3:
            raise status_error(504)
        return "turn"

    assert retry_outage("s01", fn, waits=(1, 2), sleep=waits.append) == "turn"
    assert waits == [1, 2]


def test_gives_up_after_the_last_try():
    calls = []

    def fn():
        calls.append(1)
        raise status_error(503)

    with pytest.raises(openai.APIStatusError):
        retry_outage("s01", fn, waits=(1, 2), sleep=lambda _: None)
    assert len(calls) == 3


def test_never_retries_a_bad_answer():
    calls = []

    def fn():
        calls.append(1)
        raise ValueError("unparseable output")

    with pytest.raises(ValueError):
        retry_outage("s01", fn, waits=(1, 2), sleep=lambda _: None)
    assert len(calls) == 1


def test_an_outage_swallowed_by_the_coach_node_is_recognised():
    # Seen in the gate: the coach node keeps only the class name of the provider error.
    e = RuntimeError("invalid agent output after retry: no usable output (OpenAIAPIError). Your previous answer was invalid")
    assert provider_down(e)
    assert not provider_down(RuntimeError("invalid agent output after retry: reaction too long"))


def test_upstream_404_is_retried_but_unknown_model_is_not():
    def error(message):
        return openai.NotFoundError(message, response=httpx.Response(404, request=REQUEST), body=None)
    upstream = error("Error code: 404 - Provider returned error")
    assert provider_down(upstream)
    assert not provider_down(error("Unknown model: nonexistent/model"))
    calls = []
    def invoke():
        calls.append(1)
        if len(calls) == 1:
            raise upstream
        return "valid turn"
    assert retry_outage("s24", invoke, waits=(0,), sleep=lambda _: None) == "valid turn"
    assert len(calls) == 2


def test_upstream_404_wrapped_by_coach_is_retried_but_invalid_json_is_not():
    assert provider_down(RuntimeError("no usable output (OpenAIModelNotFoundError)"))
    assert not provider_down(RuntimeError("no usable output (ValidationError)"))
