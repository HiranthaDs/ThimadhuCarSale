import uuid

from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from blacklist.model import VehicleBlacklist, VehicleBlacklistImage

SEARCHABLE_COLUMNS = ["vehicle_number", "chassis_number", "remarks"]


class VehicleBlacklistRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(
        self, *, images: list[str], created_by: uuid.UUID | None, **fields
    ) -> VehicleBlacklist:
        entry = VehicleBlacklist(created_by=created_by, **fields)
        entry.images = [VehicleBlacklistImage(image=img) for img in images]
        self.db.add(entry)
        self.db.commit()
        self.db.refresh(entry)
        return entry

    def get_by_id(self, entry_id: uuid.UUID) -> VehicleBlacklist | None:
        stmt = (
            select(VehicleBlacklist)
            .options(selectinload(VehicleBlacklist.images))
            .where(VehicleBlacklist.id == entry_id)
        )
        return self.db.scalar(stmt)

    def list_all(self, q: str | None = None) -> list[VehicleBlacklist]:
        stmt = select(VehicleBlacklist).options(selectinload(VehicleBlacklist.images))
        if q:
            pattern = f"%{q.strip()}%"
            conditions = [getattr(VehicleBlacklist, col).ilike(pattern) for col in SEARCHABLE_COLUMNS]
            stmt = stmt.where(or_(*conditions))
        stmt = stmt.order_by(VehicleBlacklist.created_at.desc())
        return list(self.db.scalars(stmt))

    def update(self, entry: VehicleBlacklist, *, images: list[str], **fields) -> VehicleBlacklist:
        for key, value in fields.items():
            setattr(entry, key, value)
        existing = {img.image: img for img in entry.images}
        entry.images = [existing.pop(img, None) or VehicleBlacklistImage(image=img) for img in images]
        self.db.commit()
        self.db.refresh(entry)
        return entry

    def delete(self, entry: VehicleBlacklist) -> None:
        self.db.delete(entry)
        self.db.commit()
