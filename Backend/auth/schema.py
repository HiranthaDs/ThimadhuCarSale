import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from auth.model import UserRole

# bcrypt (used for hashing) only looks at a password's first 72 bytes; letting
# a longer one through would silently truncate it, so this is a hard cap
# rather than just a nicety.
MAX_PASSWORD_LENGTH = 72


def _check_password_strength(value: str) -> str:
    if len(value.encode("utf-8")) > MAX_PASSWORD_LENGTH:
        raise ValueError("Password must be at most 72 bytes.")
    if not any(c.isalpha() for c in value) or not any(c.isdigit() for c in value):
        raise ValueError("Password must contain at least one letter and one number.")
    return value


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)


class UserCreateRequest(BaseModel):
    """Used by an owner to open an account for a ceo, admin, accountant, or technician member."""

    email: EmailStr
    full_name: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=8, max_length=MAX_PASSWORD_LENGTH)
    role: UserRole

    @field_validator("password")
    @classmethod
    def password_strength(cls, value: str) -> str:
        return _check_password_strength(value)

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
    current_password: str = Field(min_length=1, max_length=72)
    new_password: str = Field(min_length=8, max_length=MAX_PASSWORD_LENGTH)

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, value: str) -> str:
        return _check_password_strength(value)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    challenge_id: uuid.UUID
    otp: str = Field(pattern=r"^[0-9]{6}$")
    new_password: str = Field(min_length=8, max_length=MAX_PASSWORD_LENGTH)

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, value: str) -> str:
        return _check_password_strength(value)


class ForgotPasswordResetRequest(ResetPasswordRequest):
    email: EmailStr


class OtpSentResponse(BaseModel):
    challenge_id: uuid.UUID
    message: str
    resend_after_seconds: int
    expires_in_seconds: int


class PasswordResetResponse(BaseModel):
    message: str


class SessionUserOut(UserOut):
    """The signed-in user, with the permission keys their role currently has."""

    permissions: list[str] = []


class BrowserSessionResponse(BaseModel):
    user: SessionUserOut
