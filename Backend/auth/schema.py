import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from auth.model import UserRole


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserCreateRequest(BaseModel):
    """Used by an owner to open an account for a co, accountant, or technician member."""

    email: EmailStr
    full_name: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=8, max_length=128)
    role: UserRole

    def ensure_creatable_role(self) -> None:
        if self.role == UserRole.owner:
            raise ValueError("Owner accounts cannot be created through this endpoint.")


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    full_name: str
    role: UserRole
    is_active: bool
    created_at: datetime


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
