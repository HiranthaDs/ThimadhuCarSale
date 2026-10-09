import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from activity.service import ActivityLogService
from auth.model import User, UserRole
from permissions.catalog import CEO_ONLY_KEYS, DEFAULT_PERMISSIONS, PERMISSION_KEYS, PERMISSIONS, REQUIRES
from permissions.model import UserPermission

APPROVER_ROLE_ORDER = (UserRole.ceo, UserRole.admin, UserRole.accountant, UserRole.technician)


class PermissionService:
    def __init__(self, db: Session):
        self.db = db

    def for_user(self, user) -> set[str]:
        if user.role == UserRole.owner:
            return set(PERMISSION_KEYS)
        row = self.db.get(UserPermission, user.id)
        if row is None:
            return set(DEFAULT_PERMISSIONS.get(user.role, ()))
        return self._allowed(user, row.permissions)

    def approver_roles(self, permission: str = "clients.approve") -> list[str]:
        """Roles that must approve before the owner (client profiles, or with
        "reports.approve" / "reports2.approve" an inspection report): every role
        with at least one active person who has that Approve tick."""
        users = self.db.scalars(select(User).where(User.is_active.is_(True), User.role != UserRole.owner))
        found = {user.role for user in users if permission in self.for_user(user)}
        return [role.value for role in APPROVER_ROLE_ORDER if role in found]

    @staticmethod
    def _allowed(user, keys) -> set[str]:
        keys = set(keys) & PERMISSION_KEYS
        return keys if user.role == UserRole.ceo else keys - CEO_ONLY_KEYS

    def _employee(self, user: User) -> dict:
        return {
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "role": user.role,
            "full_access": user.role == UserRole.owner,
            "customized": self.db.get(UserPermission, user.id) is not None,
            "permissions": sorted(self.for_user(user)),
        }

    def _editable_user(self, user_id: uuid.UUID) -> User:
        user = self.db.get(User, user_id)
        if user is None:
            raise HTTPException(404, "Account not found.")
        if user.role == UserRole.owner:
            raise HTTPException(400, "The owner always has full access.")
        return user

    def overview(self) -> dict:
        users = self.db.scalars(select(User).order_by(User.created_at.desc()))
        return {
            "catalog": list(PERMISSIONS),
            "employees": [self._employee(user) for user in users],
        }

    def update(self, user_id: uuid.UUID, keys: list[str], current_user: User) -> dict:
        user = self._editable_user(user_id)
        new = self._allowed(user, keys)
        new |= {REQUIRES[key] for key in new if key in REQUIRES}
        old = self.for_user(user)

        row = self.db.get(UserPermission, user.id)
        if row is None:
            self.db.add(UserPermission(user_id=user.id, permissions=sorted(new)))
        else:
            row.permissions = sorted(new)
        self.db.commit()
        self._log_change(user, old, new, current_user)
        self._advance_client_profiles()
        return self._employee(user)

    def reset(self, user_id: uuid.UUID, current_user: User) -> dict:
        """Drop this person's custom access so they get their role's defaults again."""
        user = self._editable_user(user_id)
        old = self.for_user(user)
        row = self.db.get(UserPermission, user.id)
        if row is not None:
            self.db.delete(row)
            self.db.commit()
        self._log_change(user, old, self.for_user(user), current_user)
        self._advance_client_profiles()
        return self._employee(user)

    def _advance_client_profiles(self):
        from clients.service import ClientProfileService

        ClientProfileService(self.db).advance_ready_profiles()

    def _log_change(self, user: User, old: set[str], new: set[str], current_user: User):
        added, removed = sorted(new - old), sorted(old - new)
        if not added and not removed:
            return
        parts = [f"+{', '.join(added)}"] if added else []
        parts += [f"-{', '.join(removed)}"] if removed else []
        ActivityLogService(self.db).log(
            actor=current_user,
            action="permissions.update",
            entity_type="user",
            entity_id=user.id,
            description=f"Changed access for {user.full_name} ({user.role.value}): {' '.join(parts)}",
        )
