import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from activity.service import ActivityLogService
from auth.model import User, UserRole
from clients.model import ClientProfileStatus
from clients.repository import ClientProfileRepository
from clients.schema import ClientProfileCreate, ClientProfileUpdate


def _display_names(profile) -> str:
    names = [n for n in (profile.local_client_name, profile.foreign_client_name) if n]
    return " & ".join(names) if names else "Unnamed client"


class ClientProfileService:
    def __init__(self, db: Session):
        self.db = db
        self.repository = ClientProfileRepository(db)

    def create(self, payload: ClientProfileCreate, current_user: User):
        data = payload.model_dump()
        profile = self.repository.create(created_by=current_user.id, **data)
        ActivityLogService(self.db).log(
            actor=current_user,
            action="client.create",
            entity_type="client_profile",
            entity_id=profile.id,
            description=f"Created client profile for {_display_names(profile)}",
        )
        return profile

    def list_all(self, q: str | None = None):
        return self.repository.list_all(q)

    def get(self, profile_id: uuid.UUID):
        profile = self.repository.get_by_id(profile_id)
        if not profile:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client profile not found.")
        return profile

    def update(self, profile_id: uuid.UUID, payload: ClientProfileUpdate, current_user: User):
        profile = self.get(profile_id)
        if profile.status == ClientProfileStatus.approved and current_user.role != UserRole.owner:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This profile is approved and can only be edited by the owner.",
            )
        updated = self.repository.update(profile, **payload.model_dump())
        ActivityLogService(self.db).log(
            actor=current_user,
            action="client.update",
            entity_type="client_profile",
            entity_id=updated.id,
            description=f"Updated client profile for {_display_names(updated)}",
        )
        return updated

    def approve(self, profile_id: uuid.UUID, current_user: User):
        profile = self.get(profile_id)

        if current_user.role == UserRole.accountant:
            if profile.status != ClientProfileStatus.pending_accountant:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This profile has already passed accountant review.",
                )
            next_status = ClientProfileStatus.pending_owner
            action = "client.accountant_approve"
            description = f"Accountant approved client profile for {_display_names(profile)}"
        elif current_user.role == UserRole.owner:
            if profile.status != ClientProfileStatus.pending_owner:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This profile is awaiting accountant approval first.",
                )
            next_status = ClientProfileStatus.approved
            action = "client.owner_approve"
            description = f"Owner approved client profile for {_display_names(profile)}"
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the accountant or owner can approve client profiles.",
            )

        updated = self.repository.update(profile, status=next_status)
        ActivityLogService(self.db).log(
            actor=current_user,
            action=action,
            entity_type="client_profile",
            entity_id=updated.id,
            description=description,
        )
        return updated

    def delete(self, profile_id: uuid.UUID, current_user: User):
        profile = self.get(profile_id)
        client_name = _display_names(profile)
        self.repository.delete(profile)
        ActivityLogService(self.db).log(
            actor=current_user,
            action="client.delete",
            entity_type="client_profile",
            entity_id=profile_id,
            description=f"Deleted client profile for {client_name}",
        )
