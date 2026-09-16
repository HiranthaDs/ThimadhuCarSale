import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from clients.model import ClientDocumentType, Department, RegistrationType


def _na_if_blank(value: str | None) -> str:
    return value.strip() if value and value.strip() else "N/A"


class ClientProfileCreate(BaseModel):
    # Local client details
    has_local_client: bool = False
    local_client_name: str | None = Field(default=None, max_length=255)
    local_client_phone: str | None = None
    local_client_document_type: ClientDocumentType = ClientDocumentType.none_
    local_client_document_image: str | None = None

    # Foreign client details
    has_foreign_client: bool = False
    foreign_client_name: str | None = Field(default=None, max_length=255)
    foreign_client_country: str | None = None
    foreign_client_phone: str | None = None
    foreign_client_document_type: ClientDocumentType = ClientDocumentType.none_
    foreign_client_document_image: str | None = None

    # Document details
    cr_document_image: str | None = None
    revenue_license_image: str | None = None
    vehicle_type: str | None = None
    chassis_number: str | None = None
    vehicle_number: str | None = None

    # Previous owner details
    previous_owner_nic: str | None = None
    previous_owner_selfie_image: str | None = None
    in_writing_letter_image: str | None = None
    registration_type: RegistrationType | None = None
    previous_owner_phone: str | None = None
    scan_report_1_image: str | None = None
    scan_report_2_image: str | None = None
    garage_bill_image: str | None = None
    modification_image: str | None = None
    other_notes: str | None = None
    third_person_involved: bool = False
    third_person_image: str | None = None
    handover_selfie_image: str | None = None

    # Department details
    department: Department | None = None
    department_person_name: str | None = None

    # Payment details
    leasing_company: str | None = None
    file_signed_date: date | None = None
    payment_date: date | None = None
    bank_officer_name: str | None = None
    do_date: date | None = None
    customer_advanced_date: date | None = None
    vehicle_handover_date: date | None = None
    purchasing_date: date | None = None
    selling_price: float | None = None
    loan_amount: float | None = None
    customer_down_payment: float | None = None

    @model_validator(mode="after")
    def fill_blank_fields_with_na(self):
        if self.has_local_client:
            self.local_client_name = _na_if_blank(self.local_client_name)
            self.local_client_phone = _na_if_blank(self.local_client_phone)
        if self.has_foreign_client:
            self.foreign_client_name = _na_if_blank(self.foreign_client_name)
            self.foreign_client_country = _na_if_blank(self.foreign_client_country)
            self.foreign_client_phone = _na_if_blank(self.foreign_client_phone)

        for field in (
            "vehicle_type",
            "chassis_number",
            "vehicle_number",
            "previous_owner_nic",
            "previous_owner_phone",
            "other_notes",
            "department_person_name",
            "leasing_company",
            "bank_officer_name",
        ):
            setattr(self, field, _na_if_blank(getattr(self, field)))
        return self


class ClientProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime

    has_local_client: bool
    local_client_name: str | None
    local_client_phone: str | None
    local_client_document_type: ClientDocumentType
    local_client_document_image: str | None

    has_foreign_client: bool
    foreign_client_name: str | None
    foreign_client_country: str | None
    foreign_client_phone: str | None
    foreign_client_document_type: ClientDocumentType
    foreign_client_document_image: str | None

    cr_document_image: str | None
    revenue_license_image: str | None
    vehicle_type: str | None
    chassis_number: str | None
    vehicle_number: str | None

    previous_owner_nic: str | None
    previous_owner_selfie_image: str | None
    in_writing_letter_image: str | None
    registration_type: RegistrationType | None
    previous_owner_phone: str | None
    scan_report_1_image: str | None
    scan_report_2_image: str | None
    garage_bill_image: str | None
    modification_image: str | None
    other_notes: str | None
    third_person_involved: bool
    third_person_image: str | None
    handover_selfie_image: str | None

    department: Department | None
    department_person_name: str | None

    leasing_company: str | None
    file_signed_date: date | None
    payment_date: date | None
    bank_officer_name: str | None
    do_date: date | None
    customer_advanced_date: date | None
    vehicle_handover_date: date | None
    purchasing_date: date | None
    selling_price: float | None
    loan_amount: float | None
    customer_down_payment: float | None


class ClientProfileSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    has_local_client: bool
    local_client_name: str | None
    local_client_phone: str | None
    has_foreign_client: bool
    foreign_client_name: str | None
    foreign_client_country: str | None
    foreign_client_phone: str | None
    vehicle_number: str | None
    chassis_number: str | None
    previous_owner_nic: str | None
    department: Department | None
