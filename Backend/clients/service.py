import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from activity.service import ActivityLogService
from auth.model import User
from clients.repository import ClientProfileRepository
from clients.schema import ClientProfileCreate


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
