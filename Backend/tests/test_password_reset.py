import asyncio
import json
import os
import smtplib
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from urllib.error import HTTPError, URLError

# Override real settings before importing any application module.
os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["JWT_SECRET_KEY"] = "isolated-test-secret-not-for-production"
os.environ["BREVO_API_KEY"] = "test-api-key"
os.environ["BREVO_SENDER_EMAIL"] = "sender@example.com"
os.environ["EMAIL_PROVIDER"] = "brevo_api"
os.environ["SMTP_USERNAME"] = "test@smtp-brevo.com"
os.environ["SMTP_PASSWORD"] = "test-smtp-key"
os.environ["SMTP_SENDER_EMAIL"] = "sender@example.com"

from fastapi import FastAPI, HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import ValidationError
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from activity.model import ActivityLog
from auth.dependencies import get_current_user
from auth.model import PasswordReset, User, UserRole
from auth.password_reset import PasswordResetService
from auth.router import router
from auth.schema import ChangePasswordRequest, LoginRequest, ResetPasswordRequest
from auth.service import AuthService
from core.config import get_settings
from core.database import Base, get_db
from core.email import send_password_reset_email
from core.security import hash_password, verify_password

settings = get_settings()


async def asgi_request(app, path, body=None, token=None):
    """Exercise real FastAPI validation and dependencies without a network server."""
    headers = [(b"content-type", b"application/json")]
    if token:
        headers.append((b"authorization", ("Bearer " + token).encode()))
    scope = {
        "type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1",
        "method": "POST", "scheme": "http", "path": path, "raw_path": path.encode(),
        "query_string": b"", "root_path": "", "headers": headers,
        "client": ("127.0.0.1", 12345), "server": ("testserver", 80),
    }
    messages = []
    async def receive():
        return {"type": "http.request", "body": json.dumps(body or {}).encode(), "more_body": False}
    async def send(message):
        messages.append(message)
    await app(scope, receive, send)
    status = next(m["status"] for m in messages if m["type"] == "http.response.start")
    raw = b"".join(m.get("body", b"") for m in messages if m["type"] == "http.response.body")
    return status, json.loads(raw)


class PasswordResetTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.old_hash = hash_password("Original123!")

    def setUp(self):
        self.engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine, expire_on_commit=False)
        self.user = User(email="owner@example.com", full_name="Test Owner",
                         hashed_password=self.old_hash, role=UserRole.owner, is_active=True)
        self.db.add(self.user)
        self.db.commit()
        self.service = PasswordResetService(self.db)
        self.sender_patch = patch("auth.password_reset.send_password_reset_email")
        self.sender = self.sender_patch.start()
        self.random_patch = patch("auth.password_reset.secrets.randbelow", return_value=123456)
        self.random_patch.start()
        self.app = FastAPI()
        self.app.include_router(router)
        self.app.dependency_overrides[get_db] = lambda: self.db

    def tearDown(self):
        self.random_patch.stop()
        self.sender_patch.stop()
        self.db.close()
        self.engine.dispose()

    def send(self):
        return self.service.request(self.user.email)

    def challenge(self):
        return self.db.get(PasswordReset, self.user.id)

    def allow_resend(self):
        self.challenge().sent_at = datetime.now(timezone.utc) - timedelta(minutes=2)
        self.db.commit()

    def assert_invalid(self, otp="123456", email=None):
        with self.assertRaises(HTTPException) as caught:
            self.service.reset(email or self.user.email, otp, "Replacement123!")
        self.assertEqual(caught.exception.status_code, 400)
        self.assertEqual(self.db.get(User, self.user.id).hashed_password, self.old_hash)

    def token(self):
        return AuthService(self.db).login(LoginRequest(email=self.user.email, password="Original123!")).access_token

    def test_success_single_use_clears_lockout_and_writes_audit(self):
        self.send()
        self.user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=10)
        self.user.failed_login_attempts = 3
        self.db.commit()
        self.service.reset(self.user.email, "123456", "Replacement123!")
        self.assertTrue(verify_password("Replacement123!", self.user.hashed_password))
        self.assertIsNone(self.user.locked_until)
        self.assertEqual(self.user.failed_login_attempts, 0)
        self.assertIsNone(self.challenge().code_hash)
        self.assertEqual(self.db.scalar(select(ActivityLog)).action, "user.reset_password")
        with self.assertRaises(HTTPException):
            self.service.reset(self.user.email, "123456", "Another123!")

    def test_code_is_not_stored_or_returned(self):
        response = self.send()
        self.sender.assert_called_once_with(self.user.email, "123456")
        self.assertEqual(len(self.challenge().code_hash), 64)
        self.assertNotIn("123456", response.model_dump_json())
        self.assertNotEqual(self.challenge().code_hash, "123456")

    def test_unknown_and_inactive_accounts_have_same_response(self):
        known = self.send().model_dump()
        unknown = self.service.request("unknown@example.com").model_dump()
        self.user.is_active = False
        self.db.commit()
        inactive = self.send().model_dump()
        self.assertEqual(known, unknown)
        self.assertEqual(known, inactive)
        self.assertEqual(self.sender.call_count, 1)
        self.assert_invalid()

    def test_email_is_case_insensitive(self):
        self.service.request("OWNER@EXAMPLE.COM")
        self.sender.assert_called_once_with("owner@example.com", "123456")

    def test_missing_credentials_return_503_without_sending(self):
        with patch.object(settings, "brevo_api_key", ""):
            with self.assertRaises(HTTPException) as caught:
                self.send()
        self.assertEqual(caught.exception.status_code, 503)
        self.sender.assert_not_called()

    def test_cooldown_and_hourly_send_limit(self):
        self.send()
        self.send()
        self.assertEqual(self.sender.call_count, 1)
        for _ in range(settings.password_reset_max_sends_per_hour + 1):
            self.allow_resend()
            self.send()
        self.assertEqual(self.sender.call_count, settings.password_reset_max_sends_per_hour)
        self.challenge().window_started_at = datetime.now(timezone.utc) - timedelta(hours=2)
        self.db.commit()
        self.send()
        self.assertEqual(self.sender.call_count, settings.password_reset_max_sends_per_hour + 1)

    def test_wrong_attempt_limit_persists_across_resends(self):
        self.send()
        for _ in range(settings.password_reset_max_attempts - 1):
            self.assert_invalid("000000")
        self.allow_resend()
        self.send()
        self.assertEqual(self.challenge().attempts, settings.password_reset_max_attempts - 1)
        self.assert_invalid("000000")
        self.assert_invalid()
        self.allow_resend()
        self.send()
        self.assertEqual(self.sender.call_count, 2)

    def test_resend_replaces_previous_code(self):
        self.send()
        self.allow_resend()
        with patch("auth.password_reset.secrets.randbelow", return_value=654321):
            self.send()
        self.assert_invalid("123456")
        self.service.reset(self.user.email, "654321", "Replacement123!")

    def test_expired_code_rejected(self):
        self.send()
        self.challenge().expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        self.db.commit()
        self.assert_invalid()

    def test_code_cannot_reset_another_account(self):
        self.send()
        other = User(email="other@example.com", full_name="Other",
                     hashed_password=self.old_hash, role=UserRole.technician, is_active=True)
        self.db.add(other)
        self.db.commit()
        self.assert_invalid(email=other.email)
        self.assertEqual(other.hashed_password, self.old_hash)

    def test_first_delivery_failure_leaves_no_challenge(self):
        self.sender.side_effect = HTTPException(503, "Delivery failed")
        with self.assertRaises(HTTPException):
            self.send()
        self.assertIsNone(self.challenge())

    def test_failed_resend_preserves_original_code(self):
        self.send()
        self.allow_resend()
        original_hash = self.challenge().code_hash
        self.sender.side_effect = HTTPException(503, "Delivery failed")
        with self.assertRaises(HTTPException):
            self.send()
        self.assertEqual(self.challenge().code_hash, original_hash)
        self.assertEqual(self.challenge().send_count, 1)
        self.service.reset(self.user.email, "123456", "Replacement123!")

    def test_reset_revokes_old_access_token(self):
        token = self.token()
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        self.assertEqual(get_current_user(credentials, self.db).id, self.user.id)
        self.send()
        self.service.reset(self.user.email, "123456", "Replacement123!")
        with self.assertRaises(HTTPException) as caught:
            get_current_user(credentials, self.db)
        self.assertEqual(caught.exception.status_code, 401)
        fresh = AuthService(self.db).login(LoginRequest(email=self.user.email, password="Replacement123!"))
        self.assertTrue(fresh.access_token)

    def test_current_password_change_consumes_code_and_revokes_token(self):
        token = self.token()
        self.send()
        AuthService(self.db).change_password(
            ChangePasswordRequest(current_password="Original123!", new_password="Replacement123!"), self.user)
        self.assertIsNone(self.challenge().code_hash)
        with self.assertRaises(HTTPException):
            get_current_user(HTTPAuthorizationCredentials(scheme="Bearer", credentials=token), self.db)

    def test_password_and_code_validation(self):
        for password in ("short1", "lettersalone", "123456789", "a1" + chr(0x754c) * 24):
            with self.subTest(password=password), self.assertRaises(ValidationError):
                ResetPasswordRequest(otp="123456", new_password=password)
        for code in ("12345", "1234567", "abcdef", "".join(chr(0xff10 + n) for n in range(1, 7))):
            with self.subTest(code=code), self.assertRaises(ValidationError):
                ResetPasswordRequest(otp=code, new_password="Replacement123!")

    def test_public_endpoints_validate_and_reset(self):
        status, response = asyncio.run(asgi_request(self.app, "/auth/forgot-password", {"email": self.user.email}))
        self.assertEqual(status, 200)
        self.assertNotIn("otp", response)
        status, _ = asyncio.run(asgi_request(self.app, "/auth/reset-password", {
            "email": self.user.email, "otp": "123456", "new_password": "Replacement123!"}))
        self.assertEqual(status, 200)
        status, _ = asyncio.run(asgi_request(self.app, "/auth/reset-password", {
            "email": self.user.email, "otp": "123456", "new_password": "Replacement123!"}))
        self.assertEqual(status, 400)
        status, _ = asyncio.run(asgi_request(self.app, "/auth/reset-password", {
            "email": self.user.email, "otp": "bad", "new_password": "short"}))
        self.assertEqual(status, 422)

    def test_settings_endpoints_require_auth_and_ignore_supplied_email(self):
        status, _ = asyncio.run(asgi_request(self.app, "/auth/password-otp"))
        self.assertEqual(status, 401)
        status, _ = asyncio.run(asgi_request(self.app, "/auth/change-password-with-otp", {
            "otp": "123456", "new_password": "Replacement123!"}))
        self.assertEqual(status, 401)
        token = self.token()
        status, _ = asyncio.run(asgi_request(self.app, "/auth/password-otp", {"email": "other@example.com"}, token))
        self.assertEqual(status, 200)
        self.sender.assert_called_once_with(self.user.email, "123456")
        status, _ = asyncio.run(asgi_request(self.app, "/auth/change-password-with-otp", {
            "email": "other@example.com", "otp": "123456", "new_password": "Replacement123!"}, token))
        self.assertEqual(status, 200)
        self.assertTrue(verify_password("Replacement123!", self.user.hashed_password))


class BrevoSmtpTests(unittest.TestCase):
    def setUp(self):
        self.config = patch.multiple(
            settings, email_provider="smtp", smtp_host="smtp-relay.brevo.com",
            smtp_port=587, smtp_username="test@smtp-brevo.com",
            smtp_password="test-smtp-key", smtp_sender_email="sender@example.com",
            smtp_sender_name="Thimadhu",
        )
        self.config.start()
        self.addCleanup(self.config.stop)

    def test_starttls_precedes_login_and_sends_otp(self):
        with patch("core.email.smtplib.SMTP") as factory, patch("core.email.urlopen") as api:
            smtp = factory.return_value.__enter__.return_value
            smtp.send_message.return_value = {}
            send_password_reset_email("recipient@example.com", "012345")
        factory.assert_called_once_with("smtp-relay.brevo.com", 587, timeout=15)
        self.assertEqual([call[0] for call in smtp.method_calls],
                         ["ehlo", "starttls", "ehlo", "login", "send_message"])
        smtp.login.assert_called_once_with("test@smtp-brevo.com", "test-smtp-key")
        message = smtp.send_message.call_args.args[0]
        self.assertEqual(message["From"], "Thimadhu <sender@example.com>")
        self.assertEqual(message["To"], "recipient@example.com")
        self.assertIn("012345", message.get_content())
        self.assertEqual(smtp.send_message.call_args.kwargs["to_addrs"], ["recipient@example.com"])
        api.assert_not_called()

    def test_port_465_uses_implicit_tls(self):
        with patch.object(settings, "smtp_port", 465), patch("core.email.smtplib.SMTP_SSL") as factory:
            smtp = factory.return_value.__enter__.return_value
            smtp.send_message.return_value = {}
            send_password_reset_email("recipient@example.com", "012345")
        self.assertEqual(factory.call_args.args, ("smtp-relay.brevo.com", 465))
        self.assertIn("context", factory.call_args.kwargs)
        smtp.starttls.assert_not_called()
        smtp.login.assert_called_once()

    def test_missing_smtp_settings_do_not_fall_back_to_api(self):
        for field in ("smtp_host", "smtp_username", "smtp_password", "smtp_sender_email"):
            with self.subTest(field=field), patch.object(settings, field, ""), \
                    patch("core.email.smtplib.SMTP") as smtp, patch("core.email.urlopen") as api:
                with self.assertRaises(HTTPException) as caught:
                    send_password_reset_email("recipient@example.com", "012345")
                self.assertEqual(caught.exception.status_code, 503)
                smtp.assert_not_called()
                api.assert_not_called()

    def test_tls_failure_never_sends_credentials(self):
        with patch("core.email.smtplib.SMTP") as factory:
            smtp = factory.return_value.__enter__.return_value
            smtp.starttls.side_effect = smtplib.SMTPNotSupportedError("TLS unavailable")
            with self.assertRaises(HTTPException):
                send_password_reset_email("recipient@example.com", "012345")
            smtp.login.assert_not_called()
            smtp.send_message.assert_not_called()

    def test_authentication_failure_is_sanitized(self):
        with patch("core.email.smtplib.SMTP") as factory:
            smtp = factory.return_value.__enter__.return_value
            smtp.login.side_effect = smtplib.SMTPAuthenticationError(535, b"secret provider details")
            with self.assertRaises(HTTPException) as caught:
                send_password_reset_email("recipient@example.com", "012345")
            self.assertEqual(caught.exception.status_code, 503)
            self.assertNotIn("secret", caught.exception.detail)
            smtp.send_message.assert_not_called()

    def test_connection_failure_is_sanitized(self):
        with patch("core.email.smtplib.SMTP", side_effect=TimeoutError("secret details")):
            with self.assertRaises(HTTPException) as caught:
                send_password_reset_email("recipient@example.com", "012345")
            self.assertEqual(caught.exception.status_code, 503)
            self.assertNotIn("secret", caught.exception.detail)

    def test_recipient_rejection_is_not_reported_as_success(self):
        with patch("core.email.smtplib.SMTP") as factory:
            factory.return_value.__enter__.return_value.send_message.return_value = {
                "recipient@example.com": (550, b"rejected"),
            }
            with self.assertRaises(HTTPException) as caught:
                send_password_reset_email("recipient@example.com", "012345")
            self.assertEqual(caught.exception.status_code, 503)


class BrevoEmailTests(unittest.TestCase):
    def test_brevo_request_uses_api_key_and_expected_payload(self):
        with patch("core.email.urlopen") as sender:
            sender.return_value.__enter__.return_value.status = 201
            send_password_reset_email("recipient@example.com", "012345")
        request = sender.call_args.args[0]
        self.assertEqual(request.full_url, "https://api.brevo.com/v3/smtp/email")
        self.assertEqual(request.get_header("Api-key"), "test-api-key")
        body = json.loads(request.data)
        self.assertEqual(body["to"], [{"email": "recipient@example.com"}])
        self.assertEqual(body["sender"]["email"], "sender@example.com")
        self.assertIn("012345", body["textContent"])
        self.assertEqual(sender.call_args.kwargs["timeout"], 15)

    def test_provider_errors_are_sanitized(self):
        errors = [
            HTTPError("https://api.brevo.com", 401, "secret provider details", None, None),
            URLError("secret provider details"), TimeoutError("secret provider details"),
        ]
        for error in errors:
            with self.subTest(error=type(error).__name__), patch("core.email.urlopen", side_effect=error):
                with self.assertRaises(HTTPException) as caught:
                    send_password_reset_email("recipient@example.com", "123456")
                self.assertEqual(caught.exception.status_code, 503)
                self.assertNotIn("secret", caught.exception.detail)


if __name__ == "__main__":
    unittest.main()
