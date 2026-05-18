"""VeriBuy Backend Configuration."""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Ollama
    ollama_base_url: str = "http://localhost:11434"
    intent_model: str = "qwen3:0.6b"
    analysis_model: str = "qwen3:0.6b"

    # Scraping
    scrape_timeout: int = 10
    max_scrape_chars: int = 5000

    # YouTube Data API v3
    youtube_api_key: str = ""

    # API Keys
    huggingface_api_key: str = ""
    serper_api_key: str = ""

    # Reddit API (PRAW)
    reddit_client_id: str = ""
    reddit_client_secret: str = ""
    reddit_user_agent: str = "VeriBuy:v1.0"

    # App
    app_env: str = "development"
    app_debug: bool = True
    cors_origins: str = "*"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
