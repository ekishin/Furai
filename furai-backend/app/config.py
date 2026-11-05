"""
Konfigurasi aplikasi dari environment variables.
Semua secret dibaca dari .env — tidak hardcode di sini.
"""
from pathlib import Path

from pydantic_settings import BaseSettings

# Cari .env di direktori furai-backend/, bukan di CWD
_ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    admin_key: str
    database_url: str = "sqlite:///./furai.db"
    allowed_origins: str = "http://localhost:3000"

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    model_config = {"env_file": str(_ENV_FILE), "env_file_encoding": "utf-8"}


settings = Settings()
