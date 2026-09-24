import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class Reminder(Base):
    __tablename__ = "reminders"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # The calendar day the reminder is for, e.g. "2026-09-25" for a car to inspect.
    remind_date: Mapped[date] = mapped_column(Date, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    remark: Mapped[str] = mapped_column(Text, nullable=False)

    # Set once someone hits the green "OK" button on a due-soon reminder, so the
    # calendar icon's siren glow stops for that task specifically.
    acknowledged: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
