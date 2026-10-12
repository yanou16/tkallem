from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    llm_provider: str = "openrouter"
    llm_model: str = "qwen/qwen3-235b-a22b-2507"
    groq_api_key: str = ""
    openrouter_api_key: str = ""
    stt_model: str = "whisper-large-v3-turbo"
    stt_provider: str = "groq,deepinfra"  # backup chain, first one tried first: groq | deepinfra
    tts_provider: str = "groq,deepinfra"  # backup chain: groq (Orpheus, limited to 100 voices/day) | deepinfra (Kokoro, needs a balance)
    deepinfra_api_key: str = ""
    voice_timeout: float = 20.0
    voice_connect_timeout: float = 3.0  # a provider that cannot be reached in 3 s is retried once, then the next one answers
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

    # Credits (see docs/CREDITS.md). 1 credit = 1 answer from the student.
    guest_secret: str = ""  # signs guest tokens (32+ characters); empty = guest mode disabled
    guest_credits: int = 40  # given once to a visitor without account
    login_bonus: int = 60  # given once to a new signed-in student
    daily_refill: int = 15  # added each day to a signed-in student...
    refill_cap: int = 45  # ...but never above this balance
    guest_ip_daily_cap: int = 30  # guest accounts one network address may create per day (shared mobile IPs are common)
    guest_daily_cap: int = 2000  # guest accounts created per day by everyone (keeps the table from being flooded)
    forwarded_hops: int = 0  # reverse proxies in front of the API (Render, Railway: 1); 0 = use the socket address
    budget_alert_ratio: float = 0.8  # warn once a day when this share of daily_spend_cap is spent
    alert_webhook_url: str = ""  # Slack or Discord incoming webhook for that warning (empty: logs only)
    budget_cache_s: float = 30.0  # how often the global daily spending is re-read from the ledger
    daily_spend_cap: int = 5000  # credits spent by everyone per day: the switch that bounds the bill (credits x cost per credit)


settings = Settings()
