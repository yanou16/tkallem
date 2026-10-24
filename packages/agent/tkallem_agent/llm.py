"""LLM factory: provider and model are swappable by configuration (OpenRouter by default, or Groq).

Backup models: `LLM_FALLBACKS="groq:openai/gpt-oss-120b,openrouter:other/model"` (comma separated `provider:model`).
When the main model fails (rate limit, outage, unusable output after its retries), the same request goes to the next
one, so a limit hit during a demo costs a second, not the session."""
import logging
import os
from functools import cache, lru_cache

from langchain_core.language_models import BaseChatModel

logger = logging.getLogger(__name__)
DEFAULT_PROVIDER = "openrouter"
DEFAULT_MODEL = "qwen/qwen3-235b-a22b-2507"  # best accuracy/price on the 30-sentence correction set


@cache
def _load_dotenv_once() -> None:
    """Read the `.env` of the working directory (the API runs from apps/api, as does pydantic-settings), without
    overriding variables already set. Without it, keys that the API sees through its settings would be missing here."""
    try:
        from dotenv import find_dotenv, load_dotenv
    except ImportError:
        return
    path = find_dotenv(usecwd=True)
    if path:
        load_dotenv(path, override=False)


def get_llm(provider: str | None = None, model: str | None = None, *, timeout: float | None = None, max_retries: int | None = None) -> BaseChatModel:
    _load_dotenv_once()
    provider = provider or os.getenv("LLM_PROVIDER", DEFAULT_PROVIDER)
    model = model or os.getenv("LLM_MODEL", DEFAULT_MODEL)
    common = {
        "model": model,
        "temperature": float(os.getenv("LLM_TEMPERATURE", "0")),  # 0: reproducible corrections
        "max_tokens": 800,  # caps runaway generations
        "timeout": timeout if timeout is not None else float(os.getenv("LLM_TIMEOUT", "20")),
        "max_retries": max_retries if max_retries is not None else int(os.getenv("LLM_MAX_RETRIES", "1")),
    }
    if provider == "groq":
        from langchain_groq import ChatGroq

        # Qwen3 models on Groq "think" by default: 10 to 15 s per turn. The coach needs the answer, not the reasoning.
        extra = {"reasoning_effort": "none"} if model.startswith("qwen/") else {}
        return ChatGroq(api_key=os.environ["GROQ_API_KEY"], **extra, **common)
    if provider == "openrouter":
        from langchain_openai import ChatOpenAI

        sort = os.getenv("OPENROUTER_PROVIDER_SORT", "latency")  # route to the fastest host of the model ("" = default)
        routing = {"sort": sort} if sort else {}
        allowed = [name.strip() for name in os.getenv("OPENROUTER_PROVIDER_ONLY", "").split(",") if name.strip()]
        if allowed:
            # A deployment/CI can restrict an unhealthy upstream without changing
            # the model or falling back to a different model's answers.
            routing.update(only=allowed, allow_fallbacks=True, require_parameters=True)
        extra = {"extra_body": {"provider": routing}} if routing else {}
        return ChatOpenAI(base_url="https://openrouter.ai/api/v1", api_key=os.environ["OPENROUTER_API_KEY"], **common, **extra)
    raise ValueError(f"unknown LLM provider: {provider}")


class _InOrder:
    """`invoke` tries each runnable in turn and returns the first answer; the last error is raised if all fail."""

    def __init__(self, runnables):
        self.runnables = list(runnables)

    def invoke(self, messages, config=None, **kwargs):
        error: Exception | None = None
        for r in self.runnables:
            try:
                return r.invoke(messages, config, **kwargs)
            except Exception as e:  # rate limit, outage, timeout, unusable output: the next model takes over
                logger.warning("LLM call failed (%s: %s), trying the next model", type(e).__name__, str(e)[:120])
                error = e
        raise error  # type: ignore[misc]


class FallbackChat:
    """Same surface as the chat model for what the agent uses (`with_structured_output`, `invoke`), but each call tries
    the models in order. The first model gets no retry of its own and a shorter timeout when backups exist: the backup
    is the retry."""

    def __init__(self, models: list[BaseChatModel]):
        self.models = models

    def with_structured_output(self, schema, **kwargs):
        bound = [m.with_structured_output(schema, **kwargs) for m in self.models]
        return _InOrder(bound)

    def invoke(self, prompt, config=None, **kwargs):
        return _InOrder(self.models).invoke(prompt, config, **kwargs)


def parse_fallbacks(spec: str) -> list[tuple[str, str]]:
    out = []
    for item in filter(None, (x.strip() for x in spec.split(","))):
        provider, _, model = item.partition(":")
        if not model:
            raise ValueError(f"LLM_FALLBACKS entry {item!r}: expected provider:model")
        out.append((provider, model))
    return out


def build_llm() -> BaseChatModel | FallbackChat:
    _load_dotenv_once()
    backups = parse_fallbacks(os.getenv("LLM_FALLBACKS", ""))
    usable = []
    for provider, model in backups:
        try:
            usable.append(get_llm(provider, model))
        except (KeyError, ValueError, ImportError):  # missing key for the backup: it is simply not used
            continue
    if not usable:
        return get_llm()
    first_timeout = os.environ.get("LLM_PRIMARY_TIMEOUT", "12")
    main = get_llm(timeout=float(first_timeout), max_retries=0)
    return FallbackChat([main, *usable])


@lru_cache
def default_llm() -> BaseChatModel | FallbackChat:
    """One client per process, built from the environment on first use."""
    return build_llm()
