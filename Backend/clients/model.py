import enum
import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class ClientDocumentType(str, enum.Enum):
    nic = "nic"
    passport = "passport"
    other = "other"
    none_ = "none"


class RegistrationType(str, enum.Enum):
    registered = "registered"
    open_book = "open_book"


class Department(str, enum.Enum):
    marketing = "marketing"
    technical = "technical"
    purchasing = "purchasing"


class ClientProfile(Base):
    __tablename__ = "client_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # ---- Local client details ----
    has_local_client: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    local_client_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    local_client_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    local_client_document_type: Mapped[ClientDocumentType] = mapped_column(
        Enum(ClientDocumentType, name="client_document_type"), nullable=False, default=ClientDocumentType.none_
    )
    local_client_document_image: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ---- Foreign client details ----
    has_foreign_client: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    foreign_client_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    foreign_client_country: Mapped[str | None] = mapped_column(String(120), nullable=True)
    foreign_client_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    foreign_client_document_type: Mapped[ClientDocumentType] = mapped_column(
        Enum(ClientDocumentType, name="foreign_client_document_type"), nullable=False, default=ClientDocumentType.none_
    )
    foreign_client_document_image: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ---- Document details ----
    cr_document_image: Mapped[str | None] = mapped_column(Text, nullable=True)
    revenue_license_image: Mapped[str | None] = mapped_column(Text, nullable=True)
    vehicle_type: Mapped[str | None] = mapped_column(String(120), nullable=True)
    chassis_number: Mapped[str | None] = mapped_column(String(120), nullable=True)
    vehicle_number: Mapped[str | None] = mapped_column(String(60), nullable=True)

    # ---- Previous owner details ----
    previous_owner_nic: Mapped[str | None] = mapped_column(String(60), nullable=True)
    previous_owner_selfie_image: Mapped[str | None] = mapped_column(Text, nullable=True)
    in_writing_letter_image: Mapped[str | None] = mapped_column(Text, nullable=True)
    registration_type: Mapped[RegistrationType | None] = mapped_column(
        Enum(RegistrationType, name="registration_type"), nullable=True
    )
    previous_owner_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    scan_report_1_image: Mapped[str | None] = mapped_column(Text, nullable=True)
    scan_report_2_image: Mapped[str | None] = mapped_column(Text, nullable=True)
    garage_bill_image: Mapped[str | None] = mapped_column(Text, nullable=True)
    modification_image: Mapped[str | None] = mapped_column(Text, nullable=True)
    other_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    third_person_involved: Mapped[bool] = mapped_column(default=False, nullable=False)
    third_person_image: Mapped[str | None] = mapped_column(Text, nullable=True)
    handover_selfie_image: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ---- Department details ----
    department: Mapped[Department | None] = mapped_column(Enum(Department, name="department"), nullable=True)
    department_person_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # ---- Payment details ----
    leasing_company: Mapped[str | None] = mapped_column(String(255), nullable=True)
    file_signed_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    payment_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    bank_officer_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    do_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    customer_advanced_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    vehicle_handover_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    purchasing_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    selling_price: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
    loan_amount: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
    customer_down_payment: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
