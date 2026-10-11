"""Readable provider errors (402 "add balance", 400 "accept the model terms"...), never containing an API key."""
import httpx

from app.config import settings


def provider_message(response: httpx.Response, limit: int = 160) -> str:
    try:
        body = response.json()
        detail = body.get("error", body.get("detail", body)) if isinstance(body, dict) else body
        if isinstance(detail, dict):
            detail = detail.get("message") or detail.get("error") or ""
        text = str(detail)
    except ValueError:
        text = response.text
    for secret in (settings.groq_api_key, settings.deepinfra_api_key, settings.openrouter_api_key):
        if secret:
            text = text.replace(secret, "<key>")
    text = " ".join(text.split())[:limit]
    return f": {text}" if text else ""
