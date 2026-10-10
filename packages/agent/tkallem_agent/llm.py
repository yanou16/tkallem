"""LLM factory: provider and model are swappable by configuration (OpenRouter by default, or Groq)."""
import os
from functools import cache, lru_cache

from langchain_core.language_models import BaseChatModel

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


def get_llm(provider: str | None = None, model: str | None = None) -> BaseChatModel:
    _load_dotenv_once()
    provider = provider or os.getenv("LLM_PROVIDER", DEFAULT_PROVIDER)
    model = model or os.getenv("LLM_MODEL", DEFAULT_MODEL)
    common = {
        "model": model,
        "temperature": float(os.getenv("LLM_TEMPERATURE", "0")),  # 0: reproducible corrections
        "max_tokens": 800,  # caps runaway generations
        "timeout": float(os.getenv("LLM_TIMEOUT", "20")),
        "max_retries": int(os.getenv("LLM_MAX_RETRIES", "1")),
    }
    if provider == "groq":
        from langchain_groq import ChatGroq

        return ChatGroq(api_key=os.environ["GROQ_API_KEY"], **common)
    if provider == "openrouter":
        from langchain_openai import ChatOpenAI

        sort = os.getenv("OPENROUTER_PROVIDER_SORT", "latency")  # route to the fastest host of the model ("" = default)
        extra = {"extra_body": {"provider": {"sort": sort}}} if sort else {}
        return ChatOpenAI(base_url="https://openrouter.ai/api/v1", api_key=os.environ["OPENROUTER_API_KEY"], **common, **extra)
    raise ValueError(f"unknown LLM provider: {provider}")


@lru_cache
def default_llm() -> BaseChatModel:
    """One client per process, built from the environment on first use."""
    return get_llm()
