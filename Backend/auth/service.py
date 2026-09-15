from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from auth.model import User, UserRole
from auth.repository import UserRepository
from auth.schema import LoginRequest, TokenResponse, UserCreateRequest
from core.security import create_access_token, hash_password, verify_password


class AuthService:
    def __init__(self, db: Session):
        self.db = db
        self.repository = UserRepository(db)

    def login(self, payload: LoginRequest) -> TokenResponse:
        user = self.repository.get_by_email(payload.email)
        if not user or not verify_password(payload.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This account has been deactivated. Contact the owner.",
            )

        token = create_access_token(subject=str(user.id), extra_claims={"role": user.role.value})
        return TokenResponse(access_token=token, user=user)

    def create_staff_or_technician(self, payload: UserCreateRequest, current_user: User) -> User:
        if current_user.role != UserRole.owner:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the owner can create staff or technician accounts.",
            )
        payload.ensure_creatable_role()

        if self.repository.get_by_email(payload.email):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists.",
            )

        return self.repository.create(
            email=payload.email,
            full_name=payload.full_name,
            hashed_password=hash_password(payload.password),
            role=payload.role,
        )

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
        return self.repository.set_active(target, is_active)

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
