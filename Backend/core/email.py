"""Brevo SMTP/API delivery. Never log credentials, codes, or provider bodies."""
import json
import logging
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import HTTPException
from core.config import get_settings

logger = logging.getLogger(__name__)


def ensure_email_configured():
    settings = get_settings()
    required = (
        (settings.smtp_host, settings.smtp_username, settings.smtp_password, settings.smtp_sender_email)
        if settings.email_provider == "smtp"
        else (settings.brevo_api_key, settings.brevo_sender_email)
    )
    if not all(value.strip() for value in required):
        raise HTTPException(503, "Password reset email is not configured yet. Contact the owner.")
    return settings


def send_password_reset_email(email: str, otp: str) -> None:
    settings = ensure_email_configured()
    subject = "Your Thimadhu password reset code"
    body = (
        f"Your password reset code is: {otp}\n\n"
        f"This code expires in {settings.password_reset_expire_minutes} minutes and can be used once.\n"
        "Do not share this code. If you did not request a password reset, ignore this email."
    )
    if settings.email_provider == "smtp":
        _send_smtp(settings, email, subject, body)
        return
    payload = {
        "sender": {"name": settings.brevo_sender_name, "email": settings.brevo_sender_email},
        "to": [{"email": email}],
        "subject": subject,
        "textContent": body,
    }
    request = Request(
        "https://api.brevo.com/v3/smtp/email",
        data=json.dumps(payload).encode("utf-8"),
        headers={"api-key": settings.brevo_api_key, "Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=15) as response:
            if response.status != 201:
                raise HTTPException(503, "Could not send the reset email. Please try again later.")
    except (HTTPError, URLError, TimeoutError, OSError) as exc:
        logger.warning("Brevo delivery failed (%s)", type(exc).__name__)
        raise HTTPException(503, "Could not send the reset email. Please try again later.") from None


def _send_smtp(settings, recipient: str, subject: str, body: str) -> None:
    message = EmailMessage()
    message["From"] = formataddr((settings.smtp_sender_name, settings.smtp_sender_email))
    message["To"] = recipient
    message["Subject"] = subject
    message.set_content(body)
    context = ssl.create_default_context()
    try:
        if settings.smtp_port == 465:
            connection = smtplib.SMTP_SSL(
                settings.smtp_host, settings.smtp_port, timeout=15, context=context,
            )
        else:
            connection = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15)
        with connection as smtp:
            if settings.smtp_port != 465:
                smtp.ehlo()
                # Require TLS before sending credentials; never fall back to plaintext.
                smtp.starttls(context=context)
                smtp.ehlo()
            smtp.login(settings.smtp_username, settings.smtp_password)
            refused = smtp.send_message(
                message, from_addr=settings.smtp_sender_email, to_addrs=[recipient],
            )
            if refused:
                raise smtplib.SMTPRecipientsRefused(refused)
    except (smtplib.SMTPException, OSError) as exc:
        logger.warning("Brevo SMTP delivery failed (%s)", type(exc).__name__)
        raise HTTPException(503, "Could not send the reset email. Please try again later.") from None
