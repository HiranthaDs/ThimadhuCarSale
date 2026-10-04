import uuid

import jwt
from fastapi import Depends, HTTPException, Request, status
from datetime import datetime, timezone
from core.config import get_settings
from core.rate_limit import consume
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from auth.model import AuthSession, User, UserRole, is_owner_level
from auth.repository import UserRepository
from core.database import get_db
from core.security import decode_access_token, password_version

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials if credentials else request.cookies.get("thimadhu_session")
    if not token:
        raise HTTPException(401, "Not authenticated.")
    if not credentials and request.method not in ("GET", "HEAD", "OPTIONS"):
        require_origin(request)

    try:
        payload = decode_access_token(token)
        session_id = uuid.UUID(payload["sid"])
        user_id = uuid.UUID(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token.")

    active_session = db.get(AuthSession, session_id)
    if not active_session or active_session.user_id != user_id:
        raise HTTPException(401, "Invalid or expired session.")
    expires = active_session.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires <= datetime.now(timezone.utc):
        raise HTTPException(401, "Invalid or expired session.")
    request.state.session_id = session_id
    user = UserRepository(db).get_by_id(user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account not found or inactive.")
    if payload.get("pwd") != password_version(user.hashed_password):
        raise HTTPException(status_code=401, detail="Password changed. Please sign in again.")
    request.state.user = user
    request.state.user_id = user.id
    request.state.user_role = user.role
    return user


def require_owner(current_user: User = Depends(get_current_user)) -> User:
    # The CEO has the same access as the owner.
    if not is_owner_level(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Owner or CEO access required.")
    return current_user


def require_roles(*roles: UserRole):
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You don't have access to this resource.")
        return current_user

    return dependency


require_owner_ceo_accountant = require_roles(UserRole.owner, UserRole.ceo, UserRole.accountant)


def require_origin(request: Request):
    origin = request.headers.get("origin")
    if origin not in get_settings().cors_origin_list:
        raise HTTPException(403, "Untrusted request origin.")


def rate_auth(request: Request, db: Session = Depends(get_db)):
    # Do not trust arbitrary X-Forwarded-For. Configure trusted proxy IPs in Uvicorn.
    ip = request.client.host if request.client else "unknown"
    consume(db, "auth-ip", ip, 30, 60)
