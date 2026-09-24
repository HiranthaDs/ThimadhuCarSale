import math
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from activity.service import ActivityLogService
from auth.model import User, UserRole
from auth.repository import UserRepository
from auth.schema import ChangePasswordRequest, LoginRequest, TokenResponse, UserCreateRequest
from core.config import get_settings
from core.security import create_access_token, hash_password, verify_password


class AuthService:
    def __init__(self, db: Session):
        self.db = db
        self.repository = UserRepository(db)

    def login(self, payload: LoginRequest) -> TokenResponse:
        settings = get_settings()
        user = self.repository.get_by_email(payload.email)

        if user and user.locked_until:
            now = datetime.now(timezone.utc)
            if user.locked_until > now:
                minutes_left = math.ceil((user.locked_until - now).total_seconds() / 60)
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Too many failed attempts. Try again in {minutes_left} minute(s).",
                )
            # The lockout has expired on its own — clear it before checking the password.
            self.repository.clear_login_lockout(user)

        if not user or not verify_password(payload.password, user.hashed_password):
            if user:
                self.repository.register_failed_login(
                    user,
                    max_attempts=settings.login_max_attempts,
                    lockout_minutes=settings.login_lockout_minutes,
                )
            ActivityLogService(self.db).log_anonymous(
                action="auth.login_failed",
                entity_type="user",
                description=f"Failed login attempt for {payload.email}",
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This account has been deactivated. Contact the owner.",
            )

        if user.failed_login_attempts:
            self.repository.clear_login_lockout(user)

        token = create_access_token(subject=str(user.id), extra_claims={"role": user.role.value})
        return TokenResponse(access_token=token, user=user)

    def create_staff_or_technician(self, payload: UserCreateRequest, current_user: User) -> User:
        if current_user.role != UserRole.owner:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the owner can create accounts.",
            )
        payload.ensure_creatable_role()

        if self.repository.get_by_email(payload.email):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists.",
            )

        new_user = self.repository.create(
            email=payload.email,
            full_name=payload.full_name,
            hashed_password=hash_password(payload.password),
            role=payload.role,
        )
        ActivityLogService(self.db).log(
            actor=current_user,
            action="user.create",
            entity_type="user",
            entity_id=new_user.id,
            description=f"Created {new_user.role.value} account for {new_user.full_name} ({new_user.email})",
        )
        return new_user

    def list_users(self, current_user: User) -> list[User]:
        if current_user.role != UserRole.owner:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the owner can view all accounts.",
            )
        return self.repository.list_all()

    def set_account_active(self, user_id, is_active: bool, current_user: User) -> User:
        if current_user.role != UserRole.owner:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the owner can update account status.",
            )
        target = self.repository.get_by_id(user_id)
        if not target:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found.")
        if target.role == UserRole.owner:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot modify the owner account.")
        updated = self.repository.set_active(target, is_active)
        ActivityLogService(self.db).log(
            actor=current_user,
            action="user.activate" if is_active else "user.deactivate",
            entity_type="user",
            entity_id=updated.id,
            description=f"{'Activated' if is_active else 'Deactivated'} account for {updated.full_name} ({updated.email})",
        )
        return updated

    def change_password(self, payload: ChangePasswordRequest, current_user: User) -> User:
        if not verify_password(payload.current_password, current_user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect.",
            )
        updated = self.repository.set_password(current_user, hash_password(payload.new_password))
        ActivityLogService(self.db).log(
            actor=current_user,
            action="user.change_password",
            entity_type="user",
            entity_id=updated.id,
            description=f"{updated.full_name} ({updated.email}) changed their password",
        )
        return updated

    def bootstrap_owner(self, *, email: str, password: str, full_name: str) -> None:
        """Ensures exactly one owner account exists, created on first startup."""
        if not email or not password:
            return
        if self.repository.get_by_email(email):
            return
        if self.repository.count_by_role(UserRole.owner) > 0:
            return
        self.repository.create(
            email=email,
            full_name=full_name,
            hashed_password=hash_password(password),
            role=UserRole.owner,
        )
