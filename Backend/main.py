from contextlib import asynccontextmanager

from pathlib import Path

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy import text

from activity.router import router as activity_router
from auth.router import router as auth_router
from auth.service import AuthService
from blacklist.router import router as blacklist_router
from clients.router import router as clients_router
from reminders.router import router as reminders_router
from reports.router import router as reports_router
from core.config import get_settings
from core.database import Base, SessionLocal, engine

# Import models so they are registered on Base before create_all runs.
from auth import model  # noqa: F401
from activity import model as activity_model  # noqa: F401
from blacklist import model as blacklist_model  # noqa: F401
from clients import model as client_model  # noqa: F401
from reminders import model as reminder_model  # noqa: F401
from reports import model as report_model  # noqa: F401

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)

    # There's no migration tool in this project — create_all only adds tables
    # that don't exist yet, so a column added to a model after its table was
    # first created (like `reminders.acknowledged`) needs to be patched in by
    # hand here. Safe to run every startup.
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE reminders ADD COLUMN IF NOT EXISTS acknowledged boolean NOT NULL DEFAULT false"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts integer NOT NULL DEFAULT 0"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until timestamptz"))
        conn.execute(text("ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS scan_report_1_upload text"))
        conn.execute(text("ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS scan_report_2_upload text"))
        conn.execute(text("ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS marketing_person_name varchar(255)"))
        conn.execute(text("ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS technical_person_name varchar(255)"))
        conn.execute(text("ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS purchasing_person_name varchar(255)"))
        conn.execute(text("ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS extra_departments json"))
        for dept in ("marketing", "technical", "purchasing"):
            # Carry over profiles saved with the old single department + person.
            conn.execute(text(
                f"UPDATE client_profiles SET {dept}_person_name = department_person_name "
                f"WHERE {dept}_person_name IS NULL AND department::text = '{dept}'"
            ))
        for prefix in ("local", "foreign"):
            conn.execute(text(f"ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS {prefix}_client_document_types varchar(60)"))
            for doc in ("nic", "passport", "other"):
                conn.execute(text(f"ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS {prefix}_client_{doc}_number varchar(120)"))
                conn.execute(text(f"ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS {prefix}_client_{doc}_image text"))
            conn.execute(text(f"ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS {prefix}_client_handover_selfie_image text"))
            # Carry over profiles saved with the old single "identification document".
            conn.execute(text(
                f"UPDATE client_profiles SET {prefix}_client_document_types = {prefix}_client_document_type::text, "
                f"{prefix}_client_nic_image = CASE WHEN {prefix}_client_document_type::text = 'nic' THEN {prefix}_client_document_image END, "
                f"{prefix}_client_passport_image = CASE WHEN {prefix}_client_document_type::text = 'passport' THEN {prefix}_client_document_image END, "
                f"{prefix}_client_other_image = CASE WHEN {prefix}_client_document_type::text = 'other' THEN {prefix}_client_document_image END "
                f"WHERE {prefix}_client_document_types IS NULL AND {prefix}_client_document_type::text <> 'none'"
            ))
        # The "co" role was renamed to "ceo"; rename the existing enum value in
        # place (not idempotent via IF EXISTS, so only run it if "co" is still there).
        if conn.execute(text("SELECT 1 FROM pg_enum WHERE enumlabel = 'co' "
                              "AND enumtypid = 'user_role'::regtype")).first():
            conn.execute(text("ALTER TYPE user_role RENAME VALUE 'co' TO 'ceo'"))

    db = SessionLocal()
    try:
        AuthService(db).bootstrap_owner(
            email=settings.owner_bootstrap_email,
            password=settings.owner_bootstrap_password,
            full_name=settings.owner_bootstrap_name,
        )
    finally:
        db.close()

    yield


app = FastAPI(
    title="Thimadu API",
    version="1.0.0",
    lifespan=lifespan,
    # Interactive docs list every endpoint and schema for anyone who finds the
    # URL. Fine while developing; set APP_ENV=production in the deployed .env
    # to close them off once the API is live.
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
    openapi_url=None if settings.is_production else "/openapi.json",
)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Standard defensive headers on every response — cheap insurance against
    MIME-sniffing, clickjacking and referrer leakage."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        if request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
        return response


class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    """Rejects requests up front (before reading the body) whose declared
    Content-Length is past the configured cap, so one oversized request can't
    exhaust server memory."""

    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > settings.max_request_body_bytes:
            return JSONResponse(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                content={"detail": "Request body is too large."},
            )
        return await call_next(request)


app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(BodySizeLimitMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(clients_router)
app.include_router(blacklist_router)
app.include_router(reminders_router)
app.include_router(activity_router)
app.include_router(reports_router)

uploads_dir = Path(__file__).resolve().parent / "uploads"
uploads_dir.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")


@app.get("/health")
def health():
    return {"status": "ok"}
