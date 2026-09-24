import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from reminders.model import Reminder


class ReminderRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, *, created_by: uuid.UUID | None, **fields) -> Reminder:
        reminder = Reminder(created_by=created_by, **fields)
        self.db.add(reminder)
        self.db.commit()
        self.db.refresh(reminder)
        return reminder

    def get_by_id(self, reminder_id: uuid.UUID) -> Reminder | None:
        return self.db.scalar(select(Reminder).where(Reminder.id == reminder_id))

    def list_range(self, start: date | None = None, end: date | None = None) -> list[Reminder]:
        stmt = select(Reminder)
        if start is not None:
            stmt = stmt.where(Reminder.remind_date >= start)
        if end is not None:
            stmt = stmt.where(Reminder.remind_date <= end)
        stmt = stmt.order_by(Reminder.remind_date.asc(), Reminder.created_at.asc())
        return list(self.db.scalars(stmt))

    def update(self, reminder: Reminder, **fields) -> Reminder:
        for key, value in fields.items():
            setattr(reminder, key, value)
        self.db.commit()
        self.db.refresh(reminder)
        return reminder

    def delete(self, reminder: Reminder) -> None:
        self.db.delete(reminder)
        self.db.commit()
