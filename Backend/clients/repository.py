import uuid

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

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
    "previous_owner_nic",
    "previous_owner_phone",
    "other_notes",
    "department_person_name",
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

    def get_by_id(self, profile_id: uuid.UUID) -> ClientProfile | None:
        return self.db.get(ClientProfile, profile_id)

    def list_all(self, q: str | None = None) -> list[ClientProfile]:
        stmt = select(ClientProfile)
        if q:
            pattern = f"%{q.strip()}%"
            conditions = [getattr(ClientProfile, col).ilike(pattern) for col in SEARCHABLE_COLUMNS]
            stmt = stmt.where(or_(*conditions))
        stmt = stmt.order_by(ClientProfile.created_at.desc())
        return list(self.db.scalars(stmt))

    def update(self, profile: ClientProfile, **fields) -> ClientProfile:
        for key, value in fields.items():
            setattr(profile, key, value)
        self.db.commit()
        self.db.refresh(profile)
        return profile

    def delete(self, profile: ClientProfile) -> None:
        self.db.delete(profile)
        self.db.commit()
