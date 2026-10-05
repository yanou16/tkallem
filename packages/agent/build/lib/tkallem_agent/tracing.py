"""Langfuse tracing (spec: trace every agent call). Off unless LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY are set.
Traces contain the student's text (never a name or an email): keep the Langfuse project private."""
import os


def enabled() -> bool:
    return bool(os.getenv("LANGFUSE_PUBLIC_KEY") and os.getenv("LANGFUSE_SECRET_KEY"))


def run_config(run_name: str, session_id: str | None = None, tags: list[str] | None = None) -> dict:
    """LangChain `config` for one agent call: Langfuse callback (if enabled) + session and tags for grouping."""
    config: dict = {"run_name": run_name, "metadata": {}}
    if session_id:
        config["metadata"]["langfuse_session_id"] = session_id
    if tags:
        config["metadata"]["langfuse_tags"] = tags
    if enabled():
        from langfuse.langchain import CallbackHandler

        config["callbacks"] = [CallbackHandler()]
    return config


def flush() -> None:
    """Send pending traces now (short-lived processes such as the CLI or evals)."""
    if enabled():
        from langfuse import get_client

        get_client().flush()
