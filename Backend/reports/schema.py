import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, computed_field, field_validator

from reports.model import REPORT_STATUSES, STATUS_CHECKED


class InspectionReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    registration_number: str | None
    vehicle_title: str | None
    buyer_name: str | None
    technician_name: str | None
    url: str
    status: str

    @computed_field
    @property
    def editable(self) -> bool:
        return self.status != STATUS_CHECKED


class InspectionReportDetail(InspectionReportOut):
    form_data: dict[str, Any] | None = None


class InspectionReportUpdate(BaseModel):
    registration_number: str | None = None
    vehicle_title: str | None = None
    buyer_name: str | None = None


class InspectionReportStatusUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        if value not in REPORT_STATUSES:
            raise ValueError(f"status must be one of {REPORT_STATUSES}")
        return value
