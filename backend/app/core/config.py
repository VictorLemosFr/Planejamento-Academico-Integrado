from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    demo_enabled: bool = False
    environment: str = "development"
    allowed_origins: list[str] = ["http://127.0.0.1:5173", "http://localhost:5173"]
    database_url: str = "postgresql+psycopg://pai:pai@127.0.0.1:54329/pai"


@lru_cache
def get_settings():
    return Settings()
