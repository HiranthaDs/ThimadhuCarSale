import re
import urllib.request
import uuid
from typing import Any

from sqlalchemy.orm import Session

from core.r2_client import delete_report_pdf, upload_report_pdf
from reports.model import STATUS_CHECKED, STATUS_PENDING
from reports.repository import ReportRepository


def _safe_filename(name: str | None, fallback: str) -> str:
    name = (name or "").strip()
    if not name:
        name = fallback
    # Strip characters that aren't safe in an R2 object key.
    name = re.sub(r'[\\/:*?"<>|]+', "-", name)
    return name


SCAN2_SUFFIX = "-Scan2"


def is_scan2(registration_number: str | None) -> bool:
    return (registration_number or "").strip().lower().endswith(SCAN2_SUFFIX.lower())


def scan2_name(registration_number: str) -> str:
    """"CBE-1245" -> "CBE-1245-Scan2" (idempotent)."""
    base = registration_number.strip()
    if is_scan2(base):
        base = base[: -len(SCAN2_SUFFIX)]
    return f"{base}{SCAN2_SUFFIX}"


class ReportService:
    def __init__(self, db: Session):
        self.db = db
        self.repository = ReportRepository(db)

    def upload_pdf(
        self,
        content: bytes,
        *,
        registration_number: str | None = None,
        vehicle_title: str | None = None,
        buyer_name: str | None = None,
        created_by: uuid.UUID | None = None,
        technician_name: str | None = None,
        form_data: dict[str, Any] | None = None,
    ):
        public_id = _safe_filename(registration_number, fallback=f"report-{uuid.uuid4()}")
        url = upload_report_pdf(content, public_id)

        report = self.repository.create(
            created_by=created_by,
            registration_number=registration_number,
            vehicle_title=vehicle_title,
            buyer_name=buyer_name,
            technician_name=technician_name,
            url=url,
            form_data=form_data,
        )
        return report

    def replace_pdf(
        self,
        report,
        content: bytes,
        *,
        registration_number: str | None = None,
        vehicle_title: str | None = None,
        buyer_name: str | None = None,
        technician_name: str | None = None,
        form_data: dict[str, Any] | None = None,
    ):
        if report.status == STATUS_CHECKED:
            raise PermissionError("This report has already been checked and can no longer be edited.")

        # A Scan 2 report keeps its "-Scan2" name even though the form itself
        # carries the plain vehicle registration number.
        if is_scan2(report.registration_number):
            registration_number = scan2_name(registration_number or report.registration_number)

        old_url = report.url

        public_id = _safe_filename(registration_number, fallback=f"report-{uuid.uuid4()}")
        url = upload_report_pdf(content, public_id)

        if old_url and old_url != url:
            delete_report_pdf(old_url)

        return self.repository.update(
            report,
            registration_number=registration_number,
            vehicle_title=vehicle_title,
            buyer_name=buyer_name,
            technician_name=technician_name,
            url=url,
            form_data=form_data,
            status=STATUS_PENDING,
        )

    def create_scan2(self, report, *, created_by: uuid.UUID | None, technician_name: str | None = None):
        """Create "<REG>-Scan2" as an editable copy of an approved report.

        The original row and its PDF file are left completely untouched -
        the Scan 1 report still has to be sent to the client as-is.
        """
        if is_scan2(report.registration_number):
            raise ValueError("This report is already a Scan 2 report.")
        if not (report.registration_number or "").strip():
            raise ValueError("The report has no registration number, so a Scan 2 copy cannot be named.")
        if report.status != STATUS_CHECKED:
            raise ValueError("A Scan 2 copy can only be created after the owner has approved the report.")

        scan2_registration = scan2_name(report.registration_number)
        existing = self.repository.find_by_registration(scan2_registration)
        if existing:
            raise FileExistsError(f"{existing.registration_number} already exists.")

        public_id = _safe_filename(scan2_registration, fallback=f"report-{uuid.uuid4()}")
        content = urllib.request.urlopen(report.url, timeout=30).read() if report.url else b""
        url = upload_report_pdf(content, public_id)

        form_data = {**(report.form_data or {}), "scanNumber": 2}

        return self.repository.create(
            created_by=created_by,
            registration_number=scan2_registration,
            vehicle_title=report.vehicle_title,
            buyer_name=report.buyer_name,
            technician_name=technician_name or report.technician_name,
            url=url,
            form_data=form_data,
            status=STATUS_PENDING,
        )

    def list_all(self, q: str | None = None, status: str | None = None):
        return self.repository.list_all(q, status)

    def get(self, report_id: uuid.UUID):
        return self.repository.get(report_id)

    def update_fields(self, report, *, registration_number=None, vehicle_title=None, buyer_name=None):
        if report.status == STATUS_CHECKED:
            raise PermissionError("This report has already been checked and can no longer be edited.")
        return self.repository.update(
            report,
            registration_number=registration_number,
            vehicle_title=vehicle_title,
            buyer_name=buyer_name,
        )

    def set_status(self, report, status: str):
        return self.repository.set_status(report, status)

    def delete(self, report):
        delete_report_pdf(report.url)
        self.repository.delete(report)
