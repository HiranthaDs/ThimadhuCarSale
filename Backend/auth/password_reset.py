import hashlib
import hmac
import logging
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from activity.service import ActivityLogService
from auth.model import AuthSession, ResetChallenge, User
from auth.schema import OtpSentResponse, PasswordResetResponse
from core.config import get_settings
from core.database import SessionLocal
from core.email import ensure_email_configured, send_password_reset_email
from core.rate_limit import consume
from core.security import hash_password

logger = logging.getLogger(__name__)
INVALID_CODE = "Invalid or expired code. Request a new code if needed."


def utc(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def code_digest(user_id, challenge_id, otp):
    return hmac.new(get_settings().jwt_secret_key.encode(),
                    f"password-reset:{user_id}:{challenge_id}:{otp}".encode(), hashlib.sha256).hexdigest()


def challenge_response(challenge_id=None):
    settings = ensure_email_configured()
    return OtpSentResponse(
        challenge_id=challenge_id or uuid.uuid4(),
        message="If an active account matches this email, a reset code will be sent. Check your inbox and spam folder.",
        resend_after_seconds=settings.password_reset_resend_seconds,
        expires_in_seconds=settings.password_reset_expire_minutes * 60,
    )


def deliver_challenge(email, challenge_id):
    # Independent DB session; HTTP response never waits for SMTP or reveals delivery errors.
    with SessionLocal() as db:
        try:
            PasswordResetService(db).issue(email, challenge_id)
        except Exception as exc:
            db.rollback()
            logger.warning("Password reset delivery failed (%s)", type(exc).__name__)


class PasswordResetService:
    def __init__(self, db: Session):
        self.db = db

    def issue(self, email, challenge_id):
        settings = ensure_email_configured()
        # A generous account-wide quota is a second layer; requesters have stricter IP limits.
        consume(self.db, "reset-account", email.lower(), settings.password_reset_max_sends_per_hour, 3600)
        user = self.db.scalar(select(User).where(User.email == email.lower(), User.is_active.is_(True)))
        if not user:
            self.db.rollback()
            return
        now = datetime.now(timezone.utc)
        user_id, destination = user.id, user.email
        otp = f"{secrets.randbelow(1000000):06d}"
        challenge = ResetChallenge(
            id=challenge_id, user_id=user_id, code_hash=code_digest(user_id, challenge_id, otp),
            expires_at=now + timedelta(minutes=settings.password_reset_expire_minutes), attempts=0,
        )
        self.db.execute(delete(ResetChallenge).where(ResetChallenge.expires_at < now))
        self.db.add(challenge)
        self.db.commit()
        # No database transaction or account lock held while waiting for the network.
        try:
            send_password_reset_email(destination, otp)
        except Exception:
            self.db.execute(delete(ResetChallenge).where(ResetChallenge.id == challenge_id))
            self.db.commit()
            raise

    def request(self, email):
        result = challenge_response()
        self.issue(email, result.challenge_id)
        return result

    def reset(self, email, otp, new_password, challenge_id):
        # Lock in a consistent user -> challenge order for simultaneous resets.
        user = self.db.scalar(select(User).where(User.email == email.lower()).with_for_update()
                              .execution_options(populate_existing=True))
        challenge = self.db.scalar(select(ResetChallenge).where(
            ResetChallenge.id == challenge_id).with_for_update().execution_options(populate_existing=True))
        if (not user or not user.is_active or not challenge or challenge.user_id != user.id
                or not challenge.code_hash or utc(challenge.expires_at) <= datetime.now(timezone.utc)
                or challenge.attempts >= get_settings().password_reset_max_attempts):
            self.db.rollback()
            raise HTTPException(400, INVALID_CODE)
        if not hmac.compare_digest(challenge.code_hash, code_digest(user.id, challenge.id, otp)):
            challenge.attempts += 1
            if challenge.attempts >= get_settings().password_reset_max_attempts:
                challenge.code_hash = None
            self.db.commit()
            raise HTTPException(400, INVALID_CODE)
        user.hashed_password = hash_password(new_password)
        user.failed_login_attempts = 0
        user.locked_until = None
        self.db.execute(delete(AuthSession).where(AuthSession.user_id == user.id))
        self.db.execute(delete(ResetChallenge).where(ResetChallenge.user_id == user.id))
        self.db.commit()
        ActivityLogService(self.db).log(
            actor=user, action="user.reset_password", entity_type="user", entity_id=user.id,
            description=f"{user.full_name} reset their password using email verification",
        )
        return PasswordResetResponse(message="Password updated successfully. Sign in with your new password.")
