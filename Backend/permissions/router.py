import uuid
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from auth.dependencies import require_owner
from auth.model import User
from core.config import get_settings
from core.database import get_db
from core.rate_limit import consume
from core.security import verify_password
from permissions.schema import AccessOverviewOut, EmployeeAccessOut, EmployeeAccessUpdate
from permissions.service import PermissionService

router = APIRouter(prefix="/permissions", tags=["permissions"])

UNLOCK_MINUTES = 15
_UNLOCK_PURPOSE = "customize"


class UnlockRequest(BaseModel):
    password: str = Field(min_length=1, max_length=72)


class UnlockResponse(BaseModel):
    unlock_token: str
    expires_in_seconds: int


@router.post("/unlock", response_model=UnlockResponse)
def unlock_customize(
    payload: UnlockRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    """The owner re-enters their password to open Customize. The returned pass
    only works for this login session and expires after UNLOCK_MINUTES."""
    consume(db, "customize-unlock", str(current_user.id), 10, 600)
    if not verify_password(payload.password, current_user.hashed_password):
        # 403, not 401: a wrong password here must not sign the owner out.
        raise HTTPException(403, "Incorrect password.")
    settings = get_settings()
    claims = {
        "sub": str(current_user.id),
        "sid": str(request.state.session_id),
        "purpose": _UNLOCK_PURPOSE,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=UNLOCK_MINUTES),
    }
    token = jwt.encode(claims, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return UnlockResponse(unlock_token=token, expires_in_seconds=UNLOCK_MINUTES * 60)


def require_unlocked(
    request: Request,
    x_customize_unlock: str | None = Header(default=None),
    current_user: User = Depends(require_owner),
) -> User:
    settings = get_settings()
    try:
        claims = jwt.decode(x_customize_unlock or "", settings.jwt_secret_key, algorithms=[settings.jwt_algorithm],
                            options={"require": ["exp", "sub", "sid", "purpose"]})
    except jwt.PyJWTError:
        claims = {}
    if (claims.get("purpose") != _UNLOCK_PURPOSE or claims.get("sub") != str(current_user.id)
            or claims.get("sid") != str(request.state.session_id)):
        raise HTTPException(403, "Enter your password to open Customize.")
    return current_user


@router.get("/", response_model=AccessOverviewOut)
def get_access_overview(db: Session = Depends(get_db), current_user: User = Depends(require_unlocked)):
    return PermissionService(db).overview()


@router.put("/users/{user_id}", response_model=EmployeeAccessOut)
def update_employee_access(
    user_id: uuid.UUID,
    payload: EmployeeAccessUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_unlocked),
):
    return PermissionService(db).update(user_id, payload.permissions, current_user)


@router.delete("/users/{user_id}", response_model=EmployeeAccessOut)
def reset_employee_access(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_unlocked),
):
    return PermissionService(db).reset(user_id, current_user)
