import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from activity.service import ActivityLogService
from auth.model import User
from blacklist.repository import VehicleBlacklistRepository
from blacklist.schema import VehicleBlacklistCreate


class VehicleBlacklistService:
    def __init__(self, db: Session):
        self.db = db
        self.repository = VehicleBlacklistRepository(db)

    def create(self, payload: VehicleBlacklistCreate, current_user: User):
        data = payload.model_dump()
        images = data.pop("images")
        entry = self.repository.create(images=images, created_by=current_user.id, **data)
        ActivityLogService(self.db).log(
            actor=current_user,
            action="blacklist.create",
            entity_type="vehicle_blacklist",
            entity_id=entry.id,
            description=f"Added vehicle {entry.vehicle_number or entry.chassis_number} to the blacklist",
        )
        return entry

    def list_all(self, q: str | None = None):
        return self.repository.list_all(q)

    def get(self, entry_id: uuid.UUID):
        entry = self.repository.get_by_id(entry_id)
        if not entry:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Blacklist entry not found.")
        return entry

    def delete(self, entry_id: uuid.UUID, current_user: User):
        entry = self.get(entry_id)
        vehicle_label = entry.vehicle_number or entry.chassis_number
        self.repository.delete(entry)
        ActivityLogService(self.db).log(
            actor=current_user,
            action="blacklist.delete",
            entity_type="vehicle_blacklist",
            entity_id=entry_id,
            description=f"Removed vehicle {vehicle_label} from the blacklist",
        )
