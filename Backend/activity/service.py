import uuid

from sqlalchemy.orm import Session

from activity.repository import ActivityLogRepository
from auth.model import User


class ActivityLogService:
    def __init__(self, db: Session):
        self.repository = ActivityLogRepository(db)

    def log(
        self,
        *,
        actor: User,
        action: str,
        entity_type: str,
        description: str,
        entity_id: uuid.UUID | None = None,
    ):
        return self.repository.create(
            actor_id=actor.id,
            actor_name=actor.full_name,
            actor_role=actor.role.value,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            description=description,
        )

    def list_all(self, limit: int = 200):
        return self.repository.list_all(limit)
