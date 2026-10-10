from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

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
    cloudinary_cloud_name: str = ""
    cloudinary_api_key: str = ""
    cloudinary_api_secret: str = ""

    @property
    def allowed_frontend_origins(self) -> tuple[str, ...]:
        return tuple(
            origin.strip().rstrip("/")
            for origin in self.frontend_origin.split(",")
            if origin.strip()
        )


settings = Settings()
