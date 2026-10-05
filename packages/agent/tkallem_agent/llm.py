"""LLM factory: provider and model are swappable by configuration (Groq or OpenRouter)."""
import os

from langchain_core.language_models import BaseChatModel


def get_llm(provider: str | None = None, model: str | None = None) -> BaseChatModel:
    provider = provider or os.getenv("LLM_PROVIDER", "groq")
    model = model or os.getenv("LLM_MODEL", "llama-3.3-70b-versatile")
    if provider == "groq":
        from langchain_groq import ChatGroq

        return ChatGroq(model=model, temperature=float(os.getenv("LLM_TEMPERATURE", "0")), max_tokens=800, api_key=os.environ["GROQ_API_KEY"])
    if provider == "openrouter":
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(
            model=model,
            temperature=float(os.getenv("LLM_TEMPERATURE", "0")),
            max_tokens=800,
            base_url="https://openrouter.ai/api/v1",
            api_key=os.environ["OPENROUTER_API_KEY"],
        )
    raise ValueError(f"unknown LLM provider: {provider}")
