import hashlib
import hmac
import re
import time
import uuid
from typing import Any

from sqlalchemy.orm import Session
from fastapi import HTTPException
from activity.model import ActivityLog
from core.r2_client import existing_reference, canonical_url

from core.media import decode_data_url, validate_file
from core.config import get_settings
from core.r2_client import FORM_ATTACHMENT_PREFIX, delete_form_attachment, delete_report_pdf, get_report_pdf_bytes, upload_form_attachment, upload_report_pdf
from auth.model import ROLE_LABELS, UserRole
from core.approvals import approved_roles
from reports.model import STATUS_CHECKED, STATUS_NEEDS_MODIFICATIONS, STATUS_PENDING
from reports.repository import ReportRepository


def _safe_filename(name: str | None, fallback: str) -> str:
    name = (name or "").strip()
    if not name:
        name = fallback
    # Strip characters that aren't safe in an R2 object key.
    name = re.sub(r'[\\/:*?"<>|]+', "-", name)
    return name


# Photos are uploaded ahead of the report (POST /reports/attachments) so the
# final save carries only short references instead of every photo again. Each
# reference comes back signed for the uploading user, "r2://...#<expires>.<sig>",
# which is what lets a brand-new report point at an object it did not upload
# itself without allowing references to arbitrary objects in the bucket.
ATTACHMENT_TICKET_SECONDS = 24 * 3600


def _attachment_signature(user_id, ref: str, expires: int) -> str:
    message = f"{user_id}:{ref}:{expires}".encode()
    return hmac.new(get_settings().jwt_secret_key.encode(), message, hashlib.sha256).hexdigest()


def sign_attachment(user_id, ref: str) -> str:
    expires = int(time.time()) + ATTACHMENT_TICKET_SECONDS
    return f"{ref}#{expires}.{_attachment_signature(user_id, ref, expires)}"


def _verified_attachment(value: str, user_id) -> str | None:
    ref, _, ticket = value.partition("#")
    expires, _, signature = ticket.partition(".")
    if user_id is None or not expires.isdigit() or int(expires) < time.time():
        return None
    if not ref.startswith(f"r2://reports/{FORM_ATTACHMENT_PREFIX}/"):
        return None
    if not hmac.compare_digest(signature, _attachment_signature(user_id, ref, int(expires))):
        return None
    return ref


def _offload_form_data(value, allowed=(), depth=0, user_id=None):
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
            if value.startswith("r2://") and "#" in value:
                ref = _verified_attachment(value, user_id)
                if not ref:
                    raise HTTPException(400, "A photo upload has expired. Save the report again.")
                return ref
            if value.startswith(("https://", "http://", "r2://", "javascript:", "data:")):
                return existing_reference(value, allowed)
            return value
        content_type, content = decoded
        return upload_form_attachment(content, content_type)
    if isinstance(value, list):
        return [_offload_form_data(v, allowed, depth + 1, user_id) for v in value]
    if isinstance(value, dict):
        return {k: _offload_form_data(v, allowed, depth + 1, user_id) for k, v in value.items()}
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


def approval_permission(report) -> str:
    """Which Approve tick applies: Inspection Report 2 copies have their own."""
    return "reports2.approve" if is_scan2(report.registration_number) else "reports.approve"


class ReportService:
    def __init__(self, db: Session, actor=None):
        self.db = db
        self._approver_cache: dict[str, list[str]] = {}
        self.repository = ReportRepository(db)
        self.repository.actor = actor

    def _actor_id(self):
        return self.repository.actor.id if self.repository.actor else None

    def upload_attachments(self, files: list[str]) -> list[str]:
        """Store report photos ahead of the report itself; returns signed references."""
        user_id = self._actor_id()
        refs = []
        for value in files:
            decoded = decode_data_url(value)
            if not decoded:
                raise HTTPException(400, "Each attachment must be an image or PDF file.")
            content_type, content = decoded
            refs.append(sign_attachment(user_id, upload_form_attachment(content, content_type)))
        return refs

    def require_editor(self, report, user):
        from permissions.service import PermissionService

        if user is None or (report.created_by != user.id
                            and "reports.review" not in PermissionService(self.db).for_user(user)):
            raise HTTPException(403, "Only the report creator or a reviewer can edit this report.")


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
        content = validate_file(content, "application/pdf", get_settings().max_report_pdf_bytes)
        public_id = str(uuid.uuid4())
        url = upload_report_pdf(content, public_id)
        form_data = _offload_form_data(form_data, user_id=self._actor_id()) if form_data else form_data

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

        content = validate_file(content, "application/pdf", get_settings().max_report_pdf_bytes)
        public_id = str(uuid.uuid4())
        url = upload_report_pdf(content, public_id)
        form_data = _offload_form_data(form_data, old_form_urls, user_id=self._actor_id()) if form_data else form_data

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
            # New content: everyone approves again.
            role_approvals=[],
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
            if path.stat().st_size > get_settings().max_report_pdf_bytes:
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

    # ---- Approvals: every role with the Approve tick, then the owner checks it ----

    def _approver_roles(self, permission: str) -> list[str]:
        if permission not in self._approver_cache:
            from permissions.service import PermissionService

            self._approver_cache[permission] = PermissionService(self.db).approver_roles(permission)
        return self._approver_cache[permission]

    def annotate(self, report):
        """Set `waiting_for`: roles that still need to approve before the owner."""
        if report.status == STATUS_PENDING:
            done = approved_roles(report.role_approvals)
            report.waiting_for = [r for r in self._approver_roles(approval_permission(report)) if r not in done]
        else:
            report.waiting_for = []
        return report

    def approve(self, report, user, permissions: set[str]):
        if user.role == UserRole.owner:
            raise ValueError("The owner approves a report by marking it checked.")
        if approval_permission(report) not in permissions:
            raise PermissionError("You can't approve this type of report.")
        if user.role.value not in self.annotate(report).waiting_for:
            raise ValueError("This report isn't waiting for your approval.")
        return self.annotate(self.repository.add_role_approval(report, user))

    def set_status(self, report, status: str):
        if status == STATUS_CHECKED:
            waiting = self.annotate(report).waiting_for
            if waiting:
                labels = ", ".join(ROLE_LABELS.get(r, r) for r in waiting)
                raise ValueError(f"This report is still waiting for approval from: {labels}.")
        # Sent back for changes: the revised report goes through every approval again.
        return self.repository.set_status(report, status, clear_approvals=status == STATUS_NEEDS_MODIFICATIONS)

    def delete(self, report):
        delete_report_pdf(report.url)
        self.repository.delete(report)
