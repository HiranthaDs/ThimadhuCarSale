"""One-time provisioning. Keep .env.migration private and outside runtime containers."""
from pathlib import Path
import secrets
from dotenv import dotenv_values, set_key
from sqlalchemy import text
from sqlalchemy.engine import make_url

from main import Base, engine  # register application models
from core.db_permissions import grant_runtime_permissions


def provision():
    root = Path(__file__).resolve().parent
    env = root / ".env"
    migration_env = root / ".env.migration"
    settings = dotenv_values(env)
    url = make_url(settings["DATABASE_URL"])
    if url.username.split(".")[0] == "thimadhu_api":
        print("Runtime role is already configured.")
        return
    if migration_env.exists():
        raise RuntimeError("A migration credential file already exists; review it before provisioning.")
    password = secrets.token_urlsafe(36)
    # Retain administrative access in a separate ignored file before changing anything.
    set_key(str(migration_env), "DATABASE_URL", settings["DATABASE_URL"])
    with engine.begin() as conn:
        if conn.execute(text("SELECT 1 FROM pg_roles WHERE rolname='thimadhu_api'")).first():
            raise RuntimeError("Runtime role already exists; its password has not been changed.")
        conn.execute(text("CREATE ROLE thimadhu_api LOGIN PASSWORD :password NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS CONNECTION LIMIT 30"), {"password": password})
        grant_runtime_permissions(conn)
        conn.execute(text("ALTER ROLE thimadhu_api SET statement_timeout = '30s'"))
        conn.execute(text("ALTER ROLE thimadhu_api SET lock_timeout = '10s'"))
        conn.execute(text("ALTER ROLE thimadhu_api SET idle_in_transaction_session_timeout = '120s'"))
    # Supabase shared pooler usernames carry the project's suffix.
    suffix = "." + url.username.split(".", 1)[1] if "." in url.username else ""
    runtime_url = url.set(username="thimadhu_api" + suffix, password=password)
    set_key(str(env), "DATABASE_URL", runtime_url.render_as_string(hide_password=False))
    print("Restricted API role created. .env updated; admin connection retained in .env.migration.")


if __name__ == "__main__":
    try:
        provision()
    except Exception as exc:
        # Do not print SQL parameters: role provisioning includes a generated credential.
        print("Provisioning failed:", type(exc).__name__)
        raise SystemExit(1)
