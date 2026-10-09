import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response, status
from sqlalchemy import delete
from core.config import get_settings
from core.rate_limit import consume
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user, require_origin, require_permission, rate_auth
from auth.model import User, AuthSession
from auth.schema import ChangePasswordRequest, LoginRequest, TokenResponse, UserCreateRequest, UserOut
from auth.service import AuthService
from auth.password_reset import PasswordResetService, challenge_response, deliver_challenge
from auth.schema import BrowserSessionResponse, SessionUserOut
from auth.schema import (
    ForgotPasswordRequest, ForgotPasswordResetRequest, ResetPasswordRequest,
    OtpSentResponse, PasswordResetResponse,
)
from core.database import get_db
from permissions.service import PermissionService

router = APIRouter(prefix="/auth", tags=["auth"])

can_manage_accounts = require_permission("accounts.manage")


def _session_user(db: Session, user) -> SessionUserOut:
    out = SessionUserOut.model_validate(user)
    out.permissions = sorted(PermissionService(db).for_user(user))
    return out


@router.post("/login", response_model=BrowserSessionResponse, dependencies=[Depends(rate_auth), Depends(require_origin)])
def login(payload: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    ip = request.client.host if request.client else "unknown"
    consume(db, "login-requester", ip + ":" + payload.email.lower(), 10, 600)
    consume(db, "login-account", payload.email.lower(), 100, 3600)
    result = AuthService(db).login(payload)
    settings = get_settings()
    response.set_cookie("thimadhu_session", result.access_token, httponly=True,
                        secure=settings.cookie_secure, samesite=settings.cookie_samesite,
                        max_age=settings.access_token_expire_minutes * 60, path="/")
    response.headers["Cache-Control"] = "no-store"
    return BrowserSessionResponse(user=_session_user(db, result.user))


@router.post("/logout", status_code=204)
def logout(request: Request, response: Response, db: Session = Depends(get_db),
           current_user: User = Depends(get_current_user)):
    db.execute(delete(AuthSession).where(AuthSession.id == request.state.session_id))
    db.commit()
    response.delete_cookie("thimadhu_session", path="/", secure=get_settings().cookie_secure,
                           samesite=get_settings().cookie_samesite)



@router.get("/me", response_model=SessionUserOut)
def me(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return _session_user(db, current_user)


@router.patch("/change-password", response_model=UserOut)
def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return AuthService(db).change_password(payload, current_user)


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(can_manage_accounts),
):
    """Open an account (ceo, admin, accountant, or technician) with an email + password."""
    return AuthService(db).create_staff_or_technician(payload, current_user)


@router.get("/users", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), current_user: User = Depends(can_manage_accounts)):
    return AuthService(db).list_users(current_user)


@router.patch("/users/{user_id}/activate", response_model=UserOut)
def activate_user(user_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(can_manage_accounts)):
    return AuthService(db).set_account_active(user_id, True, current_user)


@router.patch("/users/{user_id}/deactivate", response_model=UserOut)
def deactivate_user(user_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(can_manage_accounts)):
    return AuthService(db).set_account_active(user_id, False, current_user)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(can_manage_accounts)):
    AuthService(db).delete_account(user_id, current_user)


@router.post("/forgot-password", response_model=OtpSentResponse, dependencies=[Depends(rate_auth)])
def forgot_password(payload: ForgotPasswordRequest, request: Request, tasks: BackgroundTasks,
                    db: Session = Depends(get_db)):
    ip = request.client.host if request.client else "unknown"
    consume(db, "reset-requester", ip + ":" + payload.email.lower(), 1, 60)
    consume(db, "reset-requester-hour", ip, 10, 3600)
    result = challenge_response()
    tasks.add_task(deliver_challenge, payload.email, result.challenge_id)
    return result


@router.post("/reset-password", response_model=PasswordResetResponse, dependencies=[Depends(rate_auth)])
def reset_password(payload: ForgotPasswordResetRequest, db: Session = Depends(get_db)):
    return PasswordResetService(db).reset(payload.email, payload.otp, payload.new_password, payload.challenge_id)


@router.post("/password-otp", response_model=OtpSentResponse, dependencies=[Depends(rate_auth)])
def request_settings_otp(tasks: BackgroundTasks, db: Session = Depends(get_db),
                         current_user: User = Depends(get_current_user)):
    consume(db, "reset-settings", str(current_user.id), 1, 60)
    result = challenge_response()
    tasks.add_task(deliver_challenge, current_user.email, result.challenge_id)
    return result


@router.post("/change-password-with-otp", response_model=PasswordResetResponse, dependencies=[Depends(rate_auth)])
def change_password_with_otp(payload: ResetPasswordRequest, db: Session = Depends(get_db),
                             current_user: User = Depends(get_current_user)):
    return PasswordResetService(db).reset(current_user.email, payload.otp, payload.new_password, payload.challenge_id)
