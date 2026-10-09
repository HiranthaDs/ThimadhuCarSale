import uuid

from sqlalchemy import or_, select
from sqlalchemy.orm import Session, load_only

from clients.model import ClientProfile

# Every free-text column a search box should be able to match against.
SEARCHABLE_COLUMNS = [
    "local_client_name",
    "local_client_phone",
    "foreign_client_name",
    "foreign_client_country",
    "foreign_client_phone",
    "vehicle_type",
    "chassis_number",
    "vehicle_number",
    "previous_owner_name",
    "previous_owner_nic",
    "previous_owner_phone",
    "other_notes",
    "marketing_person_name",
    "technical_person_name",
    "purchasing_person_name",
    "leasing_company",
    "bank_officer_name",
]


class ClientProfileRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, *, created_by: uuid.UUID | None, **fields) -> ClientProfile:
        profile = ClientProfile(created_by=created_by, **fields)
        self.db.add(profile)
        self.db.commit()
        self.db.refresh(profile)
        return profile

    def get_by_id(self, profile_id: uuid.UUID, lock=False) -> ClientProfile | None:
        stmt = select(ClientProfile).where(ClientProfile.id == profile_id)
        if lock:
            stmt = stmt.with_for_update().execution_options(populate_existing=True)
        return self.db.scalar(stmt)

    def list_all(self, q: str | None = None, limit=100, offset=0, status_filter=None) -> list[ClientProfile]:
        from clients.schema import ClientProfileSummary
        columns = ClientProfile.__table__.columns.keys()
        stmt = select(ClientProfile).options(load_only(
            *(getattr(ClientProfile, key) for key in ClientProfileSummary.model_fields if key in columns)))
        if status_filter:
            stmt = stmt.where(ClientProfile.status == status_filter)
        if q:
            pattern = f"%{q.strip()}%"
            conditions = [getattr(ClientProfile, col).ilike(pattern) for col in SEARCHABLE_COLUMNS]
            stmt = stmt.where(or_(*conditions))
        stmt = stmt.order_by(ClientProfile.created_at.desc(), ClientProfile.id.desc())
        if limit is not None:
            stmt = stmt.limit(limit).offset(offset)
        return list(self.db.scalars(stmt))

    def list_by_status(self, status) -> list[ClientProfile]:
        return list(self.db.scalars(select(ClientProfile).where(ClientProfile.status == status).with_for_update()))

    def update(self, profile: ClientProfile, **fields) -> ClientProfile:
        for key, value in fields.items():
            setattr(profile, key, value)
        self.db.commit()
        self.db.refresh(profile)
        return profile

    def delete(self, profile: ClientProfile) -> None:
        self.db.delete(profile)
        self.db.commit()
