"""Approvals given before the owner's final approval, shared by client profiles
and inspection reports. Each one is stored as {"role", "name", "at"}; rows saved
before names were recorded hold just the role string."""
from datetime import datetime, timezone

from pydantic import BaseModel, model_validator


def approval_entry(user) -> dict:
    return {"role": user.role.value, "name": user.full_name, "at": datetime.now(timezone.utc).isoformat()}


def approved_roles(entries) -> set[str]:
    return {entry["role"] if isinstance(entry, dict) else entry for entry in entries or []}


class ApprovalOut(BaseModel):
    role: str
    name: str | None = None
    at: datetime | None = None

    @model_validator(mode="before")
    @classmethod
    def from_role_only(cls, value):
        return {"role": value} if isinstance(value, str) else value
