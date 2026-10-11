from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    llm_provider: str = "openrouter"
    llm_model: str = "qwen/qwen3-235b-a22b-2507"
    groq_api_key: str = ""
    openrouter_api_key: str = ""
    stt_model: str = "whisper-large-v3-turbo"
    stt_provider: str = "groq"  # groq | deepinfra
    tts_provider: str = "groq"  # groq (Orpheus, limited to 100 voices/day) | deepinfra (Kokoro, needs a balance)
    deepinfra_api_key: str = ""
    voice_timeout: float = 20.0
    database_url: str = ""
    test_database_url: str = ""
    clerk_jwks_url: str = ""
    clerk_issuer: str = ""
    max_audio_bytes: int = 5_000_000
    max_text_chars: int = 1000
    frontend_origin: str = "http://localhost:3000"


settings = Settings()
