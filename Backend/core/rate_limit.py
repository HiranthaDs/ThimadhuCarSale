"""Shared, atomic limits across API workers; no raw email/IP stored."""
import hashlib
import hmac
import time
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import delete
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from auth.model import RateLimitBucket
from core.config import get_settings


def consume(db, scope: str, identity: str, limit: int, seconds: int):
    window = int(time.time()) // seconds
    key = hmac.new(get_settings().jwt_secret_key.encode(),
                   f"{scope}:{identity}:{window}".encode(), hashlib.sha256).hexdigest()
    insert = sqlite_insert if db.bind.dialect.name == "sqlite" else pg_insert
    stmt = insert(RateLimitBucket).values(
        key=key, count=1,
        expires_at=datetime.fromtimestamp((window + 1) * seconds, timezone.utc),
    ).on_conflict_do_update(
        index_elements=[RateLimitBucket.key],
        set_={"count": RateLimitBucket.count + 1},
        where=RateLimitBucket.count < limit,
    ).returning(RateLimitBucket.count)
    result = db.scalar(stmt)
    if secrets.randbelow(100) == 0:
        db.execute(delete(RateLimitBucket).where(
            RateLimitBucket.expires_at < datetime.now(timezone.utc) - timedelta(hours=1)))
    db.commit()
    if result is None:
        raise HTTPException(429, "Too many requests. Please try again later.",
                            headers={"Retry-After": str(seconds - int(time.time()) % seconds)})
