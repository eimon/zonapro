import json
from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "Mi API"
    API_V1_STR: str = "/api/v1"

    SECRET_KEY: str = "change-this-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 60

    # Clientes autorizados: {"client_id": "client_secret"}
    # En .env como JSON: ALLOWED_CLIENTS={"mi-app":"secreto"}
    ALLOWED_CLIENTS: dict[str, str] = {}

    @field_validator("ALLOWED_CLIENTS", mode="before")
    @classmethod
    def parse_allowed_clients(cls, v):
        if isinstance(v, str):
            return json.loads(v)
        return v

    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@db:5432/app_db"

    class Config:
        case_sensitive = True


settings = Settings()
