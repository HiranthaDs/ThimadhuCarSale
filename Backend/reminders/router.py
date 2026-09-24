import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user
from auth.model import User
from core.database import get_db
from reminders.schema import ReminderCreate, ReminderOut, ReminderUpdate
from reminders.service import ReminderService

router = APIRouter(prefix="/reminders", tags=["reminders"])

# Every logged-in role can see and manage reminders — it's a shared calendar,
# not owner-only data like the blacklist delete permission.


@router.post("/", response_model=ReminderOut, status_code=status.HTTP_201_CREATED)
def create_reminder(
    payload: ReminderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return ReminderService(db).create(payload, current_user)


@router.get("/", response_model=list[ReminderOut])
def list_reminders(
    start: date | None = Query(default=None),
    end: date | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return ReminderService(db).list_range(start, end)


@router.get("/{reminder_id}", response_model=ReminderOut)
def get_reminder(
    reminder_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    return ReminderService(db).get(reminder_id)


@router.put("/{reminder_id}", response_model=ReminderOut)
def update_reminder(
    reminder_id: uuid.UUID,
    payload: ReminderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return ReminderService(db).update(reminder_id, payload, current_user)


@router.post("/{reminder_id}/acknowledge", response_model=ReminderOut)
def acknowledge_reminder(
    reminder_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    return ReminderService(db).acknowledge(reminder_id, current_user)


@router.delete("/{reminder_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_reminder(
    reminder_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    ReminderService(db).delete(reminder_id, current_user)
