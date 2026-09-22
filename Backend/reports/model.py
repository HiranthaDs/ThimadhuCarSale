import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base

STATUS_PENDING = "pending"
STATUS_CHECKED = "checked"
STATUS_NEEDS_MODIFICATIONS = "needs_modifications"

REPORT_STATUSES = (STATUS_PENDING, STATUS_CHECKED, STATUS_NEEDS_MODIFICATIONS)


class InspectionReport(Base):
    __tablename__ = "inspection_reports"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    registration_number: Mapped[str | None] = mapped_column(String(60), nullable=True)
    vehicle_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    buyer_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    technician_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    url: Mapped[str] = mapped_column(String(1000), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default=STATUS_PENDING, server_default=STATUS_PENDING)
    form_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
