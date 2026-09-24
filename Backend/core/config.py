from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str
    supabase_url: str = ""
    supabase_anon_key: str = ""

    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 480

    owner_bootstrap_email: str = ""
    owner_bootstrap_password: str = ""
    owner_bootstrap_name: str = "Owner"

    cors_origins: str = "http://localhost:5173"

    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_reports_bucket: str = ""
    r2_reports_public_url: str = ""
    r2_blacklist_bucket: str = ""
    r2_blacklist_public_url: str = ""

    # "development" (default) leaves /docs, /redoc and /openapi.json open, which
    # is convenient while building. Set APP_ENV=production in the deployed .env
    # once the API is live, to close off that map of every endpoint and schema.
    app_env: str = "development"

    # Failed-login lockout: this many wrong passwords in a row locks the
    # account out for the given number of minutes.
    login_max_attempts: int = 5
    login_lockout_minutes: int = 15

    # Hard cap on request bodies (mainly inspection-report photo uploads), to
    # stop a single request from exhausting server memory. 30MB comfortably
    # covers a report with dozens of compressed photos.
    max_request_body_bytes: int = 30 * 1024 * 1024

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.app_env.strip().lower() == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
