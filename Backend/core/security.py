from datetime import datetime, timedelta, timezone

import jwt
from passlib.context import CryptContext

from core.config import get_settings

settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain_password: str) -> str:
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(subject: str, extra_claims: dict | None = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": subject, "exp": expire}
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])


# Only allow media that's actually an embedded image or an https link — never
# schemes like "javascript:" or "data:text/html", which the browser would
# execute if a value like this ever ends up in an <a href> or <img src>.
_SAFE_MEDIA_PREFIXES = ("data:image/", "https://")


def is_safe_media_url(value: str) -> bool:
    return isinstance(value, str) and value.startswith(_SAFE_MEDIA_PREFIXES)
