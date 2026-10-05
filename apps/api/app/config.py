from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    llm_provider: str = "groq"
    llm_model: str = "llama-3.3-70b-versatile"
    groq_api_key: str = ""
    openrouter_api_key: str = ""
    stt_model: str = "whisper-large-v3-turbo"
    database_url: str = ""
    clerk_jwks_url: str = ""
    clerk_issuer: str = ""
    max_audio_bytes: int = 5_000_000
    max_text_chars: int = 1000
    frontend_origin: str = "http://localhost:3000"


settings = Settings()
