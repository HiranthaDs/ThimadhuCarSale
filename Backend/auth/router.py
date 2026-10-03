import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user, require_owner
from auth.model import User
from auth.schema import ChangePasswordRequest, LoginRequest, TokenResponse, UserCreateRequest, UserOut
from auth.service import AuthService
from auth.password_reset import PasswordResetService
from auth.schema import (
    ForgotPasswordRequest, ForgotPasswordResetRequest, ResetPasswordRequest,
    OtpSentResponse, PasswordResetResponse,
)
from core.database import get_db

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    return AuthService(db).login(payload)


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user


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
    current_user: User = Depends(require_owner),
):
    """Owner-only: open an account (ceo, accountant, or technician) with an email + password."""
    return AuthService(db).create_staff_or_technician(payload, current_user)


@router.get("/users", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), current_user: User = Depends(require_owner)):
    return AuthService(db).list_users(current_user)


@router.patch("/users/{user_id}/activate", response_model=UserOut)
def activate_user(user_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(require_owner)):
    return AuthService(db).set_account_active(user_id, True, current_user)


@router.patch("/users/{user_id}/deactivate", response_model=UserOut)
def deactivate_user(user_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(require_owner)):
    return AuthService(db).set_account_active(user_id, False, current_user)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(require_owner)):
    AuthService(db).delete_account(user_id, current_user)


@router.post("/forgot-password", response_model=OtpSentResponse)
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    return PasswordResetService(db).request(payload.email)


@router.post("/reset-password", response_model=PasswordResetResponse)
def reset_password(payload: ForgotPasswordResetRequest, db: Session = Depends(get_db)):
    return PasswordResetService(db).reset(payload.email, payload.otp, payload.new_password)


@router.post("/password-otp", response_model=OtpSentResponse)
def request_settings_otp(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    # Always use the authenticated account's saved email.
    return PasswordResetService(db).request(current_user.email)


@router.post("/change-password-with-otp", response_model=PasswordResetResponse)
def change_password_with_otp(
    payload: ResetPasswordRequest, db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return PasswordResetService(db).reset(current_user.email, payload.otp, payload.new_password)
