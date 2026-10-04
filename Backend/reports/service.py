import re
import uuid
from typing import Any

from sqlalchemy.orm import Session
from fastapi import HTTPException
from activity.model import ActivityLog
from auth.model import UserRole, is_owner_level
from core.r2_client import existing_reference, canonical_url

from core.media import decode_data_url, validate_file
from core.r2_client import delete_form_attachment, delete_report_pdf, get_report_pdf_bytes, upload_form_attachment, upload_report_pdf
from reports.model import STATUS_CHECKED, STATUS_PENDING
from reports.repository import ReportRepository


def _safe_filename(name: str | None, fallback: str) -> str:
    name = (name or "").strip()
    if not name:
        name = fallback
    # Strip characters that aren't safe in an R2 object key.
    name = re.sub(r'[\\/:*?"<>|]+', "-", name)
    return name


def _offload_form_data(value, allowed=(), depth=0):
    """Recursively replace base64 data URLs in a form_data payload with R2 URLs.

    Inspection photos (and the odd attached PDF) arrive as data: URLs inside
    the JSON form_data blob; storing them there would bloat every report row
    with megabytes of duplicate image data already burned into the PDF.
    """
    if depth > 20:
        raise HTTPException(400, "Report data is too deeply nested.")
    if isinstance(value, str):
        decoded = decode_data_url(value)
        if not decoded:
            if value.startswith(("https://", "http://", "r2://", "javascript:", "data:")):
                return existing_reference(value, allowed)
            return value
        content_type, content = decoded
        return upload_form_attachment(content, content_type)
    if isinstance(value, list):
        return [_offload_form_data(v, allowed, depth + 1) for v in value]
    if isinstance(value, dict):
        return {k: _offload_form_data(v, allowed, depth + 1) for k, v in value.items()}
    return value


def _collect_urls(value, into: set[str]) -> None:
    if isinstance(value, str):
        if value.startswith(("https://", "r2://")):
            into.add(value)
    elif isinstance(value, list):
        for item in value:
            _collect_urls(item, into)
    elif isinstance(value, dict):
        for item in value.values():
            _collect_urls(item, into)


SCAN2_SUFFIX = "-Inspection Report 2"
LEGACY_COPY_SUFFIX = "-Scan2"


def is_scan2(registration_number: str | None) -> bool:
    return (registration_number or "").strip().lower().endswith((SCAN2_SUFFIX.lower(), LEGACY_COPY_SUFFIX.lower()))


def scan2_name(registration_number: str) -> str:
    """"CBE-1245" -> "CBE-1245-Inspection Report 2" (idempotent)."""
    base = registration_number.strip()
    for suffix in (SCAN2_SUFFIX, LEGACY_COPY_SUFFIX):
        if base.lower().endswith(suffix.lower()):
            base = base[:-len(suffix)]
            break
    return f"{base}{SCAN2_SUFFIX}"


class ReportService:
    def __init__(self, db: Session, actor=None):
        self.db = db
        self.repository = ReportRepository(db)
        self.repository.actor = actor

    @staticmethod
    def require_editor(report, user):
        if user is None or (not is_owner_level(user) and report.created_by != user.id):
            raise HTTPException(403, "Only the report creator or owner can edit this report.")


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
        content = validate_file(content, "application/pdf")
        public_id = str(uuid.uuid4())
        url = upload_report_pdf(content, public_id)
        form_data = _offload_form_data(form_data) if form_data else form_data

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
        current_user=None,
    ):
        self.require_editor(report, current_user)
        if report.status == STATUS_CHECKED:
            raise PermissionError("This report has already been checked and can no longer be edited.")

        # A copy keeps its Inspection Report 2 suffix even though the form itself
        # carries the plain vehicle registration number.
        if is_scan2(report.registration_number):
            registration_number = scan2_name(registration_number or report.registration_number)

        old_url = report.url
        old_form_urls: set[str] = set()
        _collect_urls(report.form_data, old_form_urls)

        content = validate_file(content, "application/pdf")
        public_id = str(uuid.uuid4())
        url = upload_report_pdf(content, public_id)
        form_data = _offload_form_data(form_data, old_form_urls) if form_data else form_data

        if old_url and old_url != url:
            delete_report_pdf(old_url)

        new_form_urls: set[str] = set()
        _collect_urls(form_data, new_form_urls)
        for removed_url in old_form_urls - new_form_urls:
            delete_form_attachment(removed_url)

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
        """Create "<REG>-Inspection Report 2" as an editable copy of an approved report.

        The original row and its PDF file are left completely untouched -
        the Scan 1 report still has to be sent to the client as-is.
        """
        if is_scan2(report.registration_number):
            raise ValueError("This report is already an Inspection Report 2.")
        if not (report.registration_number or "").strip():
            raise ValueError("The report has no registration number, so an Inspection Report 2 copy cannot be named.")
        if report.status != STATUS_CHECKED:
            raise ValueError("An Inspection Report 2 copy can only be created after the owner has approved the report.")

        scan2_registration = scan2_name(report.registration_number)
        existing = self.repository.find_by_registration(scan2_registration) or self.repository.find_by_registration(report.registration_number + LEGACY_COPY_SUFFIX)
        if existing:
            raise FileExistsError(f"{existing.registration_number} already exists.")

        if len(scan2_registration) > 60:
            raise ValueError("Registration number is too long for an Inspection Report 2 name.")
        public_id = _safe_filename(scan2_registration, fallback=f"report-{uuid.uuid4()}")
        content = self.get_pdf_bytes(report)
        if not content:
            raise ValueError("Original report PDF is missing.")
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

    def list_all(self, q: str | None = None, status: str | None = None, limit=100, offset=0):
        return self.repository.list_all(q, status, limit, offset)

    def get(self, report_id: uuid.UUID, lock=False):
        return self.repository.get(report_id, lock)

    def get_pdf_bytes(self, report) -> bytes:
        if report.url.startswith("/uploads/inspection_reports/"):
            from pathlib import Path
            from core.config import get_settings
            name = report.url.removeprefix("/uploads/inspection_reports/")
            if "/" in name or chr(92) in name or ":" in name or name in (".", ".."):
                raise HTTPException(400, "Invalid document reference.")
            root = Path(__file__).resolve().parents[1] / "uploads" / "inspection_reports"
            path = root / name
            if path.is_symlink() or not path.is_file():
                return b""
            if path.stat().st_size > get_settings().max_file_bytes:
                raise HTTPException(413, "Document exceeds the file limit.")
            return path.read_bytes()
        return get_report_pdf_bytes(report.url)

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
