from functools import lru_cache
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str
    supabase_url: str = ""
    supabase_anon_key: str = ""

    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = Field(default=300, ge=5, le=480)
    cookie_secure: bool = True
    cookie_samesite: Literal["lax", "strict", "none"] = "none"
    api_root_path: str = ""
    allowed_hosts: str = "localhost,127.0.0.1"
    database_pool_size: int = Field(default=5, ge=1, le=20)
    database_max_overflow: int = Field(default=5, ge=0, le=20)
    database_sslmode: str = "verify-full"
    database_sslrootcert: str = "certs/prod-ca-2021.crt"
    auto_migrate: bool = False
    private_download_seconds: int = Field(default=900, ge=60, le=3600)
    max_file_bytes: int = Field(default=10 * 1024 * 1024, ge=1024, le=10 * 1024 * 1024)
    # Inspection report PDFs: 40-70 pages at ~0.4 MB a page, so far above the per-file cap.
    max_report_pdf_bytes: int = Field(default=60 * 1024 * 1024, ge=1024, le=100 * 1024 * 1024)
    blocking_worker_threads: int = Field(default=8, ge=2, le=32)

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

    # "development" leaves /docs, /redoc and /openapi.json open, which
    # is convenient while building. Set APP_ENV=production in the deployed .env
    # once the API is live, to close off that map of every endpoint and schema.
    app_env: str = "production"

    # Hard cap on request bodies (mainly inspection-report photo uploads), to
    # stop a single request from exhausting server memory. 30MB comfortably
    # covers a report with dozens of compressed photos.
    max_request_body_bytes: int = 64 * 1024 * 1024

    # Choose SMTP or the Brevo HTTPS API. Credentials stay on the backend.
    email_provider: Literal["brevo_api", "smtp"] = "brevo_api"
    smtp_host: str = "smtp-relay.brevo.com"
    smtp_port: int = Field(default=587, ge=1, le=65535)
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_sender_email: str = ""
    smtp_sender_name: str = "Thimadhu"
    brevo_api_key: str = ""
    brevo_sender_email: str = ""
    brevo_sender_name: str = "Thimadhu"
    password_reset_expire_minutes: int = Field(default=10, ge=1, le=30)
    password_reset_resend_seconds: int = Field(default=60, ge=30)
    password_reset_max_attempts: int = Field(default=5, ge=1, le=10)
    password_reset_max_sends_per_hour: int = Field(default=20, ge=1, le=20)

    @model_validator(mode="after")
    def validate_security_settings(self):
        if len(self.jwt_secret_key) < 32 or self.jwt_algorithm != "HS256":
            raise ValueError("Use a random JWT secret of at least 32 characters and HS256.")
        if self.is_production and (not self.cookie_secure or self.database_sslmode != "verify-full"):
            raise ValueError("Production requires secure cookies and verified database TLS.")
        if self.cookie_samesite == "none" and not self.cookie_secure:
            raise ValueError("SameSite=None requires secure cookies.")
        if "*" in self.cors_origin_list:
            raise ValueError("Explicit frontend origins are required.")
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.app_env.strip().lower() == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
