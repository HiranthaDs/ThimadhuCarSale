import math
from datetime import datetime, timezone, timedelta
import uuid

from fastapi import HTTPException, status
from sqlalchemy import select, delete
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from activity.service import ActivityLogService
from auth.model import AuthSession, ResetChallenge, PasswordReset, User, UserRole
from core.rate_limit import consume
from auth.repository import UserRepository
from auth.schema import ChangePasswordRequest, LoginRequest, TokenResponse, UserCreateRequest
from core.config import get_settings
from core.security import create_access_token, hash_password, verify_password, password_version


_DUMMY_PASSWORD_HASH = hash_password("dummy-password-not-an-account")


class AuthService:
    def __init__(self, db: Session):
        self.db = db
        self.repository = UserRepository(db)

    def login(self, payload: LoginRequest) -> TokenResponse:
        settings = get_settings()
        user = self.db.scalar(select(User).where(User.email == payload.email.lower()).with_for_update().execution_options(populate_existing=True))

        # Hash every attempt, including unknown/inactive accounts.
        # Requester limits run before this work at the route.
        candidate_hash = user.hashed_password if user else _DUMMY_PASSWORD_HASH
        valid = verify_password(payload.password, candidate_hash)
        if not user or not user.is_active or not valid:
            self.db.rollback()
            raise HTTPException(401, "Invalid email or password.")
        if user.failed_login_attempts or user.locked_until:
            user.failed_login_attempts = 0
            user.locked_until = None

        session = AuthSession(
            id=uuid.uuid4(), user_id=user.id,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes),
        )
        self.db.execute(delete(AuthSession).where(AuthSession.expires_at < datetime.now(timezone.utc)))
        self.db.add(session)
        self.db.commit()
        token = create_access_token(subject=str(user.id), extra_claims={"role": user.role.value, "pwd": password_version(user.hashed_password), "sid": str(session.id)})
        return TokenResponse(access_token=token, user=user)

    def _require_account_manager(self, current_user: User) -> None:
        from permissions.service import PermissionService

        if "accounts.manage" not in PermissionService(self.db).for_user(current_user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You don't have access to manage accounts.")

    def create_staff_or_technician(self, payload: UserCreateRequest, current_user: User) -> User:
        self._require_account_manager(current_user)
        if payload.role == UserRole.owner:
            raise HTTPException(400, "Owner accounts cannot be created through this endpoint.")

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
        self._require_account_manager(current_user)
        return self.repository.list_all()

    def set_account_active(self, user_id, is_active: bool, current_user: User) -> User:
        self._require_account_manager(current_user)
        target = self.db.scalar(select(User).where(User.id == user_id).with_for_update().execution_options(populate_existing=True))
        if not target:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found.")
        if target.role == UserRole.owner:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot modify the owner account.")
        if target.id == current_user.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot change your own account status.")
        if not is_active:
            self.db.execute(delete(AuthSession).where(AuthSession.user_id == target.id))
            self.db.execute(delete(ResetChallenge).where(ResetChallenge.user_id == target.id))
        updated = self.repository.set_active(target, is_active)
        ActivityLogService(self.db).log(
            actor=current_user,
            action="user.activate" if is_active else "user.deactivate",
            entity_type="user",
            entity_id=updated.id,
            description=f"{'Activated' if is_active else 'Deactivated'} account for {updated.full_name} ({updated.email})",
        )
        self._advance_client_profiles()
        return updated

    def delete_account(self, user_id, current_user: User) -> None:
        self._require_account_manager(current_user)
        target = self.db.scalar(select(User).where(User.id == user_id).with_for_update().execution_options(populate_existing=True))
        if not target:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found.")
        if target.role == UserRole.owner:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete the owner account.")
        if target.id == current_user.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot delete your own account.")

        description = f"Deleted account for {target.full_name} ({target.email})"
        try:
            self.repository.delete(target)
        except IntegrityError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This account has existing reports or other records and can't be deleted — deactivate it instead.",
            )
        ActivityLogService(self.db).log(
            actor=current_user,
            action="user.delete",
            entity_type="user",
            entity_id=user_id,
            description=description,
        )
        self._advance_client_profiles()

    def _advance_client_profiles(self):
        # A deactivated or deleted approver may have been the last one for their
        # role; profiles waiting only on that role move on to the owner.
        from clients.service import ClientProfileService

        ClientProfileService(self.db).advance_ready_profiles()

    def change_password(self, payload: ChangePasswordRequest, current_user: User) -> User:
        consume(self.db, "password-change-user", str(current_user.id), 5, 300)
        current_user = self.db.scalar(
            select(User).where(User.id == current_user.id).with_for_update()
            .execution_options(populate_existing=True)
        )
        if not verify_password(payload.current_password, current_user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect.",
            )
        challenge = self.db.get(PasswordReset, current_user.id)
        if challenge:
            challenge.code_hash = None
        self.db.execute(delete(AuthSession).where(AuthSession.user_id == current_user.id))
        self.db.execute(delete(ResetChallenge).where(ResetChallenge.user_id == current_user.id))
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
        if password == "ChangeMe123!" or len(password) < 16:
            raise RuntimeError("Bootstrap requires a unique password of at least 16 characters.")
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
