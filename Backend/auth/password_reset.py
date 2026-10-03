import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from activity.service import ActivityLogService
from auth.model import PasswordReset, User
from auth.schema import OtpSentResponse, PasswordResetResponse
from core.config import get_settings
from core.email import ensure_email_configured, send_password_reset_email
from core.security import hash_password

INVALID_CODE = "Invalid or expired code. Request a new code if needed."


def utc(value):
    # SQLite tests return naive datetimes; PostgreSQL preserves UTC.
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def code_digest(user_id, nonce: str, otp: str) -> str:
    return hmac.new(
        get_settings().jwt_secret_key.encode(),
        f"password-reset:{user_id}:{nonce}:{otp}".encode(),
        hashlib.sha256,
    ).hexdigest()


class PasswordResetService:
    def __init__(self, db: Session):
        self.db = db

    def locked_user(self, email):
        # Serialize sends, verification and password changes across workers.
        return self.db.scalar(
            select(User).where(User.email == email.lower()).with_for_update()
            .execution_options(populate_existing=True)
        )

    def request(self, email: str) -> OtpSentResponse:
        settings = ensure_email_configured()
        result = OtpSentResponse(
            message="If an active account matches this email, a reset code will be sent. Check your inbox and spam folder.",
            resend_after_seconds=settings.password_reset_resend_seconds,
            expires_in_seconds=settings.password_reset_expire_minutes * 60,
        )
        try:
            user = self.locked_user(email)
            if not user or not user.is_active:
                self.db.rollback()
                return result
            now = datetime.now(timezone.utc)
            challenge = self.db.get(PasswordReset, user.id)
            if challenge:
                elapsed = (now - utc(challenge.sent_at)).total_seconds()
                if elapsed < settings.password_reset_resend_seconds:
                    self.db.rollback()
                    return result
                if now - utc(challenge.window_started_at) >= timedelta(hours=1):
                    challenge.window_started_at = now
                    challenge.send_count = 0
                    challenge.attempts = 0
                if (challenge.send_count >= settings.password_reset_max_sends_per_hour
                        or challenge.attempts >= settings.password_reset_max_attempts):
                    self.db.rollback()
                    return result
            else:
                challenge = PasswordReset(
                    user_id=user.id, window_started_at=now, send_count=0, attempts=0,
                )
                self.db.add(challenge)
            otp = f"{secrets.randbelow(1000000):06d}"
            challenge.nonce = secrets.token_hex(16)
            challenge.code_hash = code_digest(user.id, challenge.nonce, otp)
            challenge.sent_at = now
            challenge.expires_at = now + timedelta(minutes=settings.password_reset_expire_minutes)
            challenge.send_count += 1
            # A failed send rolls back to the previous challenge.
            send_password_reset_email(user.email, otp)
            self.db.commit()
            return result
        except Exception:
            self.db.rollback()
            raise

    def reset(self, email: str, otp: str, new_password: str) -> PasswordResetResponse:
        settings = get_settings()
        user = self.locked_user(email)
        challenge = self.db.get(PasswordReset, user.id) if user and user.is_active else None
        if (not challenge or not challenge.code_hash
                or utc(challenge.expires_at) <= datetime.now(timezone.utc)
                or challenge.attempts >= settings.password_reset_max_attempts):
            self.db.rollback()
            raise HTTPException(400, INVALID_CODE)
        if not hmac.compare_digest(challenge.code_hash, code_digest(user.id, challenge.nonce, otp)):
            challenge.attempts += 1
            if challenge.attempts >= settings.password_reset_max_attempts:
                challenge.code_hash = None
            self.db.commit()
            raise HTTPException(400, INVALID_CODE)
        user.hashed_password = hash_password(new_password)
        user.failed_login_attempts = 0
        user.locked_until = None
        challenge.code_hash = None
        self.db.commit()
        ActivityLogService(self.db).log(
            actor=user, action="user.reset_password", entity_type="user", entity_id=user.id,
            description=f"{user.full_name} ({user.email}) reset their password using email verification",
        )
        return PasswordResetResponse(message="Password updated successfully. Sign in with your new password.")
