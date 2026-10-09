from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = "postgresql+psycopg://pai:pai@127.0.0.1:54329/pai"


@lru_cache
def get_settings():
    return Settings()
