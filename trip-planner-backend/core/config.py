from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    GROQ_API_KEY: str
    GOOGLE_GEMINI_API_KEY: str = ""
    OPENWEATHER_API_KEY: str
    LITEAPI_API_KEY: str
    AVIATIONSTACK_API_KEY: str = ""   # free tier: aviationstack.com
    OPENTRIPMAP_API_KEY: str = ""     # free tier: opentripmap.io
    NEWSAPI_KEY: str = ""             # newsapi.org for travel news
    ADMIN_SECRET: str = ""             # For admin API endpoints
    SUPABASE_URL: str
    SUPABASE_KEY: str
    NEXT_JS_ORIGIN: str = "http://localhost:3000"
    LM_STUDIO_URL: str = "http://localhost:1234/v1"
    LM_STUDIO_MODEL: str = "qwen/qwen3.5-9b"
    GROQ_DAILY_TOKEN_LIMIT: int = 80000
    GROQ_TOKEN_RESET_HOUR: int = 0

    class Config:
        env_file = (".env", "../.env")
        extra = "ignore"

settings = Settings()
