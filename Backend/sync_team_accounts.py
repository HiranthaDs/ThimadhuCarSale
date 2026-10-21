"""One-time account roster update. Run from Backend after DATABASE_URL is fixed.

The initial password is read from the terminal and is never stored in this file.
Previous accounts are disabled so records that reference them remain intact.
"""

import argparse
import getpass
import sys
from pathlib import Path

from sqlalchemy import delete, select, text
from sqlalchemy.exc import SQLAlchemyError

sys.path.insert(0, str(Path(__file__).resolve().parent))

from auth.model import AuthSession, ResetChallenge, User, UserRole  # noqa: E402
from auth.schema import UserCreateRequest  # noqa: E402
from core.database import SessionLocal  # noqa: E402
from core.security import hash_password  # noqa: E402


ROSTER = (
    ("thimadupvt@gmail.com", "Owner", UserRole.owner),
    ("shsiriwardana595@gmail.com", "CEO", UserRole.ceo),
    ("gayaniamandi16@gmail.com", "Accountant", UserRole.accountant),
    ("senithperera302@gmail.com", "Technical Officer", UserRole.technician),
    ("didulanr@gmail.com", "Technical Officer", UserRole.technician),
)


def database_error_message(exc: SQLAlchemyError) -> str:
    # Never print a database URL or raw driver error: either may include secrets.
    detail = str(getattr(exc, "orig", exc)).lower()
    if "tenant/user" in detail and "not found" in detail:
        return ("Supabase does not recognize the project or database user in DATABASE_URL. "
                "Copy a current connection string from the project's Supabase dashboard into Backend/.env.")
    if "password authentication failed" in detail:
        return "The database password in Backend/.env was rejected."
    if "certificate verify failed" in detail or "certificate validation failed" in detail:
        return "Database TLS certificate verification failed."
    if "timed out" in detail or "permission denied" in detail:
        return "The database could not be reached from this computer."
    return f"Database operation failed ({type(exc).__name__})."


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check-db", action="store_true", help="Check the database connection without changing accounts")
    args = parser.parse_args()

    roster = list(ROSTER)
    emails = [email.lower() for email, _, _ in roster]
    if len(emails) != len(set(emails)):
        print("The roster contains duplicate email addresses.", file=sys.stderr)
        return 2

    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        print(database_error_message(exc), file=sys.stderr)
        print("No accounts were changed.", file=sys.stderr)
        return 1
    if args.check_db:
        print("Database connection works. No accounts were changed.")
        return 0

    password = getpass.getpass("Initial password for all listed accounts: ")
    try:
        for email, full_name, role in roster:
            UserCreateRequest(email=email, full_name=full_name, role=role, password=password)
    except ValueError as exc:
        print(f"Invalid account details: {exc}", file=sys.stderr)
        return 2

    try:
        with SessionLocal.begin() as db:
            users = list(db.scalars(select(User).with_for_update()))
            by_email = {user.email.lower(): user for user in users}
            owners = [user for user in users if user.role == UserRole.owner]
            if len(owners) > 1:
                raise ValueError("More than one owner exists; resolve this before changing accounts.")
            target_owner = by_email.get(roster[0][0])
            if target_owner and target_owner.role != UserRole.owner:
                raise ValueError("The requested owner email already belongs to another account.")

            hashed_password = hash_password(password)
            kept_ids = set()
            for email, full_name, role in roster:
                if role == UserRole.owner and owners:
                    user = owners[0]
                else:
                    user = by_email.get(email)
                    if user is not None and user.id in kept_ids:
                        user = None
                if user is None:
                    user = User(email=email, full_name=full_name, role=role,
                                hashed_password=hashed_password, is_active=True)
                    db.add(user)
                    db.flush()
                else:
                    user.email = email
                    user.full_name = full_name
                    user.role = role
                    user.hashed_password = hashed_password
                    user.is_active = True
                    user.failed_login_attempts = 0
                    user.locked_until = None
                    db.flush()
                kept_ids.add(user.id)
                print(f"Enabled {role.value}: {email}")

            for user in users:
                if user.id not in kept_ids and user.is_active:
                    user.is_active = False
                    print(f"Disabled former account: {user.email}")

            # Existing sessions and unused OTPs must not survive the roster change.
            db.execute(delete(AuthSession))
            db.execute(delete(ResetChallenge))
        print("Account roster updated. Everyone must sign in again.")
        return 0
    except (SQLAlchemyError, ValueError) as exc:
        if isinstance(exc, SQLAlchemyError):
            print(database_error_message(exc), file=sys.stderr)
        else:
            print(f"Account update failed: {exc}", file=sys.stderr)
        print("No changes were committed.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
