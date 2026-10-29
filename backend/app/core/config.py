from functools import lru_cache

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    demo_enabled: bool = False
    environment: str = "development"
    allowed_origins: list[str] = ["http://127.0.0.1:5173", "http://localhost:5173"]
    database_url: str = "postgresql+psycopg://pai:pai@127.0.0.1:54329/pai"
    # Pasta com o build do frontend (npm run build). Quando definida, a própria
    # API entrega o site, e front e back ficam na mesma origem.
    static_dir: str | None = None
    # A Render informa a URL pública do serviço; ela vira uma origem permitida.
    render_external_url: str | None = None

    @field_validator("database_url")
    @classmethod
    def use_psycopg(cls, value: str) -> str:
        """Provedores entregam postgres://; o SQLAlchemy precisa do driver explícito."""
        for prefix in ("postgres://", "postgresql://"):
            if value.startswith(prefix):
                return "postgresql+psycopg://" + value.removeprefix(prefix)
        return value

    @model_validator(mode="after")
    def allow_public_url(self):
        url = (self.render_external_url or "").rstrip("/")
        if url and url not in self.allowed_origins:
            self.allowed_origins = [*self.allowed_origins, url]
        return self


@lru_cache
def get_settings():
    return Settings()
