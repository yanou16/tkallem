from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    llm_provider: str = "openrouter"
    llm_model: str = "qwen/qwen3-235b-a22b-2507"
    groq_api_key: str = ""
    openrouter_api_key: str = ""
    stt_model: str = "whisper-large-v3-turbo"
    stt_provider: str = "groq,deepinfra"  # backup chain, first one tried first: groq | deepinfra
    tts_provider: str = "groq,deepinfra,piper"  # backup chain: groq (Orpheus, limited to 100 voices/day) | deepinfra (Kokoro, needs a balance, 3 to 10 s) | piper (on the server, no limit: the safety net)
    piper_model_path: str = "/opt/piper/en_US-lessac-medium.onnx"  # the Piper voice (the Docker image downloads it); missing file = Piper skipped
    deepinfra_api_key: str = ""
    voice_timeout: float = 20.0  # speech to text (the recording is uploaded, then transcribed)
    tts_compress: bool = True  # send the coach's voice as MP3 instead of WAV (8x smaller); TTS_COMPRESS=false goes back to WAV at once
    tts_mp3_kbps: int = Field(64, ge=24, le=128)
    voice_echo_gate: bool = True  # VOICE_ECHO_GATE=false lets the student talk over the coach (needs good echo cancellation on the phone)
    voice_echo_hold_secs: float = Field(0.6, ge=0, le=3)  # silence kept after the coach stops, for the last words leaving the loudspeaker
    voice_call_tts_wait_secs: float = Field(4.0, ge=1, le=30)  # a call cannot wait for a slow voice: after this long the browser reads the line (the text is already on screen)
    voice_call_safety_net_wait_secs: float = Field(8.0, ge=1, le=30)  # the server's own voice (Piper) gets longer than the usual chain: it is the last one before the browser's voice
    voice_call_tts_failures_to_skip: int = Field(2, ge=1, le=10)  # this many server voice failures in a row: the browser's voice is used at once...
    voice_call_tts_skip_secs: float = Field(60.0, ge=0, le=600)  # ...for this long, before the server voice is tried again
    voice_call_enabled: bool = True  # VOICE_CALL_ENABLED=false hides the live call (the app offers the voice message) without a deploy
    cloudflare_turn_key_id: str = ""  # TURN relay for the live call: without it a browser cannot reach the server behind Azure
    cloudflare_turn_api_token: str = ""  # secret: an App Service setting, never committed
    turn_credentials_ttl_secs: int = Field(14400, ge=300, le=172800)  # per call and per side; Cloudflare allows up to 48 hours
    voice_ice_debug: bool = False  # VOICE_ICE_DEBUG=true logs every TURN/ICE exchange of the call (diagnosis only)
    tts_timeout: float = 5.0  # the coach's voice must start soon: after this many seconds the next provider (or the browser's own voice, at once) takes over
    voice_connect_timeout: float = 3.0  # a provider that cannot be reached in 3 s is retried once, then the next one answers
    database_url: str = ""
    test_database_url: str = ""
    # Connection pool of the one API process (apps/api/loadtest/README.md: the pool is the first thing to saturate).
    db_pool_min: int = Field(1, ge=0)  # connections kept open even when idle
    db_pool_max: int = Field(10, ge=1)  # connections at most
    db_pool_timeout: float = Field(10.0, gt=0)  # seconds a request waits for a free connection before failing
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
    guest_credits: int = 100  # given once to a visitor without account (a jury must be able to test freely: about 16 full sessions)
    login_bonus: int = 60  # given once to a new signed-in student
    daily_refill: int = 15  # added each day to a signed-in student...
    refill_cap: int = 45  # ...but never above this balance
    guest_ip_daily_cap: int = 100  # guest accounts one network address may create per day (a jury behind one network, shared mobile IPs)
    guest_daily_cap: int = 2000  # guest accounts created per day by everyone (keeps the table from being flooded)
    forwarded_hops: int = 0  # reverse proxies in front of the API (Render, Railway: 1); 0 = use the socket address
    budget_alert_ratio: float = 0.8  # warn once a day when this share of daily_spend_cap is spent
    alert_webhook_url: str = ""  # Slack or Discord incoming webhook for that warning (empty: logs only)
    budget_cache_s: float = 30.0  # how often the global daily spending is re-read from the ledger
    daily_spend_cap: int = 5000  # credits spent by everyone per day: the switch that bounds the bill (credits x cost per credit)

    @property
    def frontend_origins(self) -> list[str]:
        return [o.strip().rstrip("/") for o in self.frontend_origin.split(",") if o.strip()]

settings = Settings()
