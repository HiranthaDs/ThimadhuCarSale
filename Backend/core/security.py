import hashlib
import hmac

from datetime import datetime, timedelta, timezone

import jwt
import bcrypt

from core.config import get_settings

settings = get_settings()


def hash_password(plain_password: str) -> str:
    if len(plain_password.encode()) > 72:
        raise ValueError("Password exceeds 72 bytes.")
    return bcrypt.hashpw(plain_password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if len(plain_password.encode()) > 72:
        return False
    try:
        return bcrypt.checkpw(plain_password.encode(), hashed_password.encode())
    except ValueError:
        return False


def create_access_token(subject: str, extra_claims: dict | None = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": subject, "exp": expire}
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm], options={"require": ["exp", "sub", "sid", "pwd"]})


# Only allow media that's actually an embedded image or an https link — never
# schemes like "javascript:" or "data:text/html", which the browser would
# execute if a value like this ever ends up in an <a href> or <img src>.
_SAFE_MEDIA_PREFIXES = ("data:image/jpeg;base64,", "data:image/png;base64,", "data:image/webp;base64,", "data:application/pdf;base64,", "https://", "r2://")


def is_safe_media_url(value: str) -> bool:
    return isinstance(value, str) and value.startswith(_SAFE_MEDIA_PREFIXES)


def password_version(hashed_password: str) -> str:
    return hmac.new(settings.jwt_secret_key.encode(), hashed_password.encode(), hashlib.sha256).hexdigest()
