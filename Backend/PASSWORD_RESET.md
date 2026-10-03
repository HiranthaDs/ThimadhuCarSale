# Password reset email setup

1. Set EMAIL_PROVIDER=smtp in Backend/.env and the backend hosting environment.
   Set SMTP_HOST=smtp-relay.brevo.com, SMTP_PORT=587, SMTP_USERNAME to your
   Brevo SMTP login, SMTP_PASSWORD to your SMTP key, and SMTP_SENDER_EMAIL to
   your verified sender. SMTP_SENDER_NAME controls the displayed sender name.
   Credentials belong only in the backend environment, never the frontend.
2. Restart the backend. Its existing Base.metadata.create_all startup creates
   the new password_resets table automatically; no user columns are added.
3. Use **Forgot password?** on Login, or **Forgot current password?** in Settings.
   Settings always sends to the authenticated account's saved email.

SMTP requires STARTTLS on port 587/2525, or implicit TLS on 465. Credentials
are sent only over a verified TLS connection. The SMTP key is separate from
a Brevo API key and from the sender mailbox password.
Reference: https://developers.brevo.com/docs/smtp-integration

The HTTPS alternative remains available: set EMAIL_PROVIDER=brevo_api and fill
BREVO_API_KEY, BREVO_SENDER_EMAIL and BREVO_SENDER_NAME. It calls
https://api.brevo.com/v3/smtp/email. Use this if your host blocks outbound SMTP.
Reference: https://developers.brevo.com/docs/send-a-transactional-email

Defaults: six-digit codes, 10-minute expiry, 60-second resend cooldown,
five sends and five wrong guesses per account per hour. Resending replaces the
previous code without replenishing the guess budget. Limits persist in the
database across workers and restarts. Codes are stored as keyed hashes and
never returned in API responses or logs. Missing credentials return HTTP 503.
Unknown/inactive accounts and suppressed sends return the same generic message.

Successful password changes consume outstanding codes and invalidate existing
sessions. Users must sign in again. Sessions issued before this update also
require a fresh login because tokens now include a password version.

Run isolated backend tests from Backend:
venv/Scripts/python.exe -B -m unittest discover -s tests -v

Tests use an in-memory database and mocked email delivery; they do not access
Supabase or send real mail. Live email delivery needs configured credentials.

Endpoints:
- POST /auth/forgot-password: email
- POST /auth/reset-password: email, otp, new_password
- POST /auth/password-otp: authenticated, no body
- POST /auth/change-password-with-otp: authenticated, otp, new_password
