import uuid
from datetime import date

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from activity.service import ActivityLogService
from auth.model import User
from reminders.repository import ReminderRepository
from reminders.schema import ReminderCreate, ReminderUpdate


class ReminderService:
    def __init__(self, db: Session):
        self.db = db
        self.repository = ReminderRepository(db)

    def create(self, payload: ReminderCreate, current_user: User):
        reminder = self.repository.create(created_by=current_user.id, **payload.model_dump())
        ActivityLogService(self.db).log(
            actor=current_user,
            action="reminder.create",
            entity_type="reminder",
            entity_id=reminder.id,
            description=f"Set a reminder for {reminder.remind_date}: {reminder.title}",
        )
        return reminder

    def list_range(self, start: date | None, end: date | None):
        return self.repository.list_range(start, end)

    def get(self, reminder_id: uuid.UUID):
        reminder = self.repository.get_by_id(reminder_id)
        if not reminder:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reminder not found.")
        return reminder

    def update(self, reminder_id: uuid.UUID, payload: ReminderUpdate, current_user: User):
        reminder = self.get(reminder_id)
        # Editing a reminder counts as a change worth re-glowing for, so any
        # earlier "OK" acknowledgement is cleared.
        reminder = self.repository.update(reminder, acknowledged=False, **payload.model_dump())
        ActivityLogService(self.db).log(
            actor=current_user,
            action="reminder.update",
            entity_type="reminder",
            entity_id=reminder.id,
            description=f"Updated reminder for {reminder.remind_date}: {reminder.title}",
        )
        return reminder

    def acknowledge(self, reminder_id: uuid.UUID, current_user: User):
        """The green "OK" button: stop the siren glow for this one reminder."""
        reminder = self.get(reminder_id)
        reminder = self.repository.update(reminder, acknowledged=True)
        ActivityLogService(self.db).log(
            actor=current_user,
            action="reminder.acknowledge",
            entity_type="reminder",
            entity_id=reminder.id,
            description=f"Acknowledged reminder for {reminder.remind_date}: {reminder.title}",
        )
        return reminder

    def delete(self, reminder_id: uuid.UUID, current_user: User):
        reminder = self.get(reminder_id)
        label = f"{reminder.remind_date}: {reminder.title}"
        self.repository.delete(reminder)
        ActivityLogService(self.db).log(
            actor=current_user,
            action="reminder.delete",
            entity_type="reminder",
            entity_id=reminder_id,
            description=f"Removed reminder for {label}",
        )
