from core.r2_client import PrivateMediaResponse
import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from core.approvals import ApprovalOut
from reports.model import REPORT_STATUSES, STATUS_CHECKED


class InspectionReportOut(PrivateMediaResponse):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    registration_number: str | None
    vehicle_title: str | None
    buyer_name: str | None
    technician_name: str | None
    url: str
    status: str
    role_approvals: list[ApprovalOut] = []
    # Roles that still need to approve before the owner can mark it checked.
    waiting_for: list[str] = []

    editable: bool = False
    # Whether the signed-in user can give their role's approval now.
    can_approve: bool = False


class InspectionReportDetail(InspectionReportOut):
    form_data: dict[str, Any] | None = None


class InspectionReportUpdate(BaseModel):
    registration_number: str | None = Field(default=None, max_length=60)
    vehicle_title: str | None = Field(default=None, max_length=255)
    buyer_name: str | None = Field(default=None, max_length=255)


class InspectionReportStatusUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        if value not in REPORT_STATUSES:
            raise ValueError(f"status must be one of {REPORT_STATUSES}")
        return value


class InspectionReportPair(BaseModel):
    original: InspectionReportOut
    copy_report: InspectionReportOut | None = Field(default=None, alias="copy")


class ReportAttachmentUpload(BaseModel):
    files: list[str] = Field(min_length=1, max_length=20)


class ReportAttachmentRefs(BaseModel):
    refs: list[str]
