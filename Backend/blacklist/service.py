import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from activity.service import ActivityLogService
from auth.model import User
from blacklist.repository import VehicleBlacklistRepository
from blacklist.schema import VehicleBlacklistCreate, VehicleBlacklistUpdate
from core.media import decode_data_url
from core.r2_client import delete_blacklist_image, upload_blacklist_image


def _store_images(images: list[str]) -> list[str]:
    """Upload any base64 photos to R2, returning their public URLs.

    Images already sent back as an https URL (kept from a previous save) are
    left untouched.
    """
    stored = []
    for image in images:
        decoded = decode_data_url(image)
        if not decoded:
            stored.append(image)
            continue
        content_type, content = decoded
        stored.append(upload_blacklist_image(content, content_type))
    return stored


class VehicleBlacklistService:
    def __init__(self, db: Session):
        self.db = db
        self.repository = VehicleBlacklistRepository(db)

    def create(self, payload: VehicleBlacklistCreate, current_user: User):
        data = payload.model_dump()
        images = _store_images(data.pop("images"))
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

    def update(self, entry_id: uuid.UUID, payload: VehicleBlacklistUpdate, current_user: User):
        entry = self.get(entry_id)
        old_images = {img.image for img in entry.images}
        data = payload.model_dump()
        images = _store_images(data.pop("images"))
        entry = self.repository.update(entry, images=images, **data)
        for removed_url in old_images - set(images):
            delete_blacklist_image(removed_url)
        ActivityLogService(self.db).log(
            actor=current_user,
            action="blacklist.update",
            entity_type="vehicle_blacklist",
            entity_id=entry.id,
            description=f"Updated blacklisted vehicle {entry.vehicle_number or entry.chassis_number}",
        )
        return entry

    def delete(self, entry_id: uuid.UUID, current_user: User):
        entry = self.get(entry_id)
        vehicle_label = entry.vehicle_number or entry.chassis_number
        image_urls = [img.image for img in entry.images]
        self.repository.delete(entry)
        for url in image_urls:
            delete_blacklist_image(url)
        ActivityLogService(self.db).log(
            actor=current_user,
            action="blacklist.delete",
            entity_type="vehicle_blacklist",
            entity_id=entry_id,
            description=f"Removed vehicle {vehicle_label} from the blacklist",
        )
