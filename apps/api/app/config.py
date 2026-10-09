from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ENV_FILE = Path(__file__).resolve().parents[1] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ENV_FILE, extra="ignore")

    llm_provider: str = "openrouter"
    llm_model: str = "qwen/qwen3-235b-a22b-2507"
    groq_api_key: str = ""
    openrouter_api_key: str = ""
    stt_model: str = "whisper-large-v3-turbo"
    database_url: str = ""
    test_database_url: str = ""
    clerk_jwks_url: str = ""
    clerk_issuer: str = ""
    max_audio_bytes: int = 5_000_000
    max_text_chars: int = 1000
    frontend_origin: str = "http://localhost:3000"


settings = Settings()
