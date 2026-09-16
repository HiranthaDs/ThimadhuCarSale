from sqlalchemy import select
from sqlalchemy.orm import Session

from activity.model import ActivityLog


class ActivityLogRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, **fields) -> ActivityLog:
        entry = ActivityLog(**fields)
        self.db.add(entry)
        self.db.commit()
        self.db.refresh(entry)
        return entry

    def list_all(self, limit: int = 200) -> list[ActivityLog]:
        stmt = select(ActivityLog).order_by(ActivityLog.created_at.desc()).limit(limit)
        return list(self.db.scalars(stmt))
