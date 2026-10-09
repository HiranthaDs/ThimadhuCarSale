import uuid

from pydantic import BaseModel, field_validator

from auth.model import UserRole
from permissions.catalog import PERMISSION_KEYS


class PermissionOut(BaseModel):
    key: str
    section: str
    label: str
    requires: str | None = None
    ceo_only: bool = False


class EmployeeAccessOut(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str
    role: UserRole
    # The owner: always everything, not editable.
    full_access: bool
    # True once the owner has saved access for this person; otherwise they
    # have their role's defaults.
    customized: bool
    permissions: list[str]


class AccessOverviewOut(BaseModel):
    catalog: list[PermissionOut]
    employees: list[EmployeeAccessOut]


class EmployeeAccessUpdate(BaseModel):
    permissions: list[str]

    @field_validator("permissions")
    @classmethod
    def known_keys(cls, value: list[str]) -> list[str]:
        unknown = set(value) - PERMISSION_KEYS
        if unknown:
            raise ValueError(f"Unknown permissions: {', '.join(sorted(unknown))}")
        return value
