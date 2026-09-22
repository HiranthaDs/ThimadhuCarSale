import re
import shutil
import uuid
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from reports.model import STATUS_CHECKED, STATUS_PENDING
from reports.repository import ReportRepository

UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads" / "inspection_reports"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def _safe_filename(name: str | None, fallback: str) -> str:
    name = (name or "").strip()
    if not name:
        name = fallback
    # Strip characters that aren't safe in a filesystem path.
    name = re.sub(r'[\\/:*?"<>|]+', "-", name)
    return name


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
        stem = _safe_filename(registration_number, fallback=f"report-{uuid.uuid4()}")
        filename = f"{stem}.pdf"
        path = UPLOAD_DIR / filename
        if path.exists():
            filename = f"{stem}-{uuid.uuid4().hex[:8]}.pdf"
            path = UPLOAD_DIR / filename
        path.write_bytes(content)

        url = f"/uploads/inspection_reports/{filename}"

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

        old_filename = report.url.rsplit("/", 1)[-1] if report.url else None

        stem = _safe_filename(registration_number, fallback=f"report-{uuid.uuid4()}")
        filename = f"{stem}.pdf"
        path = UPLOAD_DIR / filename
        if path.exists() and filename != old_filename:
            filename = f"{stem}-{uuid.uuid4().hex[:8]}.pdf"
            path = UPLOAD_DIR / filename
        path.write_bytes(content)

        if old_filename and old_filename != filename:
            old_path = UPLOAD_DIR / old_filename
            if old_path.exists():
                old_path.unlink()

        url = f"/uploads/inspection_reports/{filename}"

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

    def copy_report(self, report, *, created_by: uuid.UUID | None, technician_name: str | None = None):
        """Duplicate a report into a brand-new, editable record.

        The original row and its PDF file are left completely untouched -
        a new file and a new DB row are created so an approved/checked
        report can never be mutated by further edits.
        """
        old_filename = report.url.rsplit("/", 1)[-1] if report.url else None
        stem = _safe_filename(report.registration_number, fallback=f"report-{uuid.uuid4()}")
        filename = f"{stem}-copy-{uuid.uuid4().hex[:8]}.pdf"
        new_path = UPLOAD_DIR / filename

        if old_filename:
            old_path = UPLOAD_DIR / old_filename
            if old_path.exists():
                shutil.copyfile(old_path, new_path)

        url = f"/uploads/inspection_reports/{filename}"

        return self.repository.create(
            created_by=created_by,
            registration_number=report.registration_number,
            vehicle_title=report.vehicle_title,
            buyer_name=report.buyer_name,
            technician_name=technician_name or report.technician_name,
            url=url,
            form_data=report.form_data,
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
        if report.url:
            filename = report.url.rsplit("/", 1)[-1]
            path = UPLOAD_DIR / filename
            if path.exists():
                path.unlink()
        self.repository.delete(report)
