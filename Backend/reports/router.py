import json
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, Response, UploadFile, status
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool
from core.config import get_settings

from auth.dependencies import get_current_user, require_owner
from auth.model import OWNER_LEVEL_ROLES, User, UserRole, is_owner_level
from core.database import get_db
from reports.model import REPORT_STATUSES, STATUS_PENDING
from reports.schema import InspectionReportDetail, InspectionReportOut, InspectionReportStatusUpdate, InspectionReportUpdate
from reports.service import ReportService
from reports.repository import ReportRepository
from reports.schema import InspectionReportPair

router = APIRouter(prefix="/reports", tags=["reports"])


def _to_out(report, request: Request) -> InspectionReportOut:
    out = InspectionReportOut.model_validate(report)
    if out.url.startswith("/"):
        out.url = str(request.base_url).rstrip("/") + f"/reports/{report.id}/download"
    out.editable = report.status != "checked" and (request.state.user_role in OWNER_LEVEL_ROLES or report.created_by == request.state.user_id)
    return out


def _to_detail(report, request: Request) -> InspectionReportDetail:
    out = InspectionReportDetail.model_validate(report)
    if out.url.startswith("/"):
        out.url = str(request.base_url).rstrip("/") + f"/reports/{report.id}/download"
    out.editable = report.status != "checked" and (request.state.user_role in OWNER_LEVEL_ROLES or report.created_by == request.state.user_id)
    return out


def _get_report_or_404(service: ReportService, report_id: uuid.UUID, lock=False):
    report = service.get(report_id, lock=lock)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inspection report not found.")
    return report


@router.post("/pdf", response_model=InspectionReportOut, status_code=status.HTTP_201_CREATED)
async def upload_report_pdf(
    request: Request,
    file: UploadFile = File(...),
    registration_number: str | None = Form(default=None, max_length=60),
    vehicle_title: str | None = Form(default=None, max_length=255),
    buyer_name: str | None = Form(default=None, max_length=255),
    form_data: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only PDF files are accepted.")

    parsed_form_data = await _parse_form_data(form_data)

    content = await file.read(get_settings().max_file_bytes + 1)
    if len(content) > get_settings().max_file_bytes:
        raise HTTPException(413, "PDF exceeds the 10 MB limit.")
    report = await run_in_threadpool(ReportService(db, current_user).upload_pdf,
        content,
        registration_number=registration_number,
        vehicle_title=vehicle_title,
        buyer_name=buyer_name,
        created_by=current_user.id,
        technician_name=current_user.full_name,
        form_data=parsed_form_data,
    )
    return _to_out(report, request)


async def _parse_form_data(form_data: UploadFile | None):
    # Arrives as a JSON file part rather than a text field: Starlette caps text
    # fields at 1MB, and the form data holds every inspection photo.
    if form_data is None:
        return None
    try:
        raw = await form_data.read(get_settings().max_request_body_bytes + 1)
        if len(raw) > get_settings().max_request_body_bytes:
            raise HTTPException(413, "Report data is too large.")
        value = json.loads(raw)
        if not isinstance(value, dict):
            raise ValueError("Expected an object")
        return value
    except (TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid form_data payload.")


@router.put("/{report_id}/pdf", response_model=InspectionReportOut)
async def replace_report_pdf(
    report_id: uuid.UUID,
    request: Request,
    file: UploadFile = File(...),
    registration_number: str | None = Form(default=None, max_length=60),
    vehicle_title: str | None = Form(default=None, max_length=255),
    buyer_name: str | None = Form(default=None, max_length=255),
    form_data: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only PDF files are accepted.")

    service = ReportService(db, current_user)
    report = await run_in_threadpool(_get_report_or_404, service, report_id, True)
    service.require_editor(report, current_user)
    parsed_form_data = await _parse_form_data(form_data)

    content = await file.read(get_settings().max_file_bytes + 1)
    if len(content) > get_settings().max_file_bytes:
        raise HTTPException(413, "PDF exceeds the 10 MB limit.")
    try:
        report = await run_in_threadpool(service.replace_pdf,
            report,
            content,
            registration_number=registration_number,
            vehicle_title=vehicle_title,
            buyer_name=buyer_name,
            technician_name=current_user.full_name,
            form_data=parsed_form_data,
            current_user=current_user,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    return _to_out(report, request)


@router.get("/", response_model=list[InspectionReportOut])
def list_reports(
    request: Request,
    q: str | None = Query(default=None, max_length=120, description="Search by registration number, vehicle, buyer or technician"),
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0, le=100000),
    status_filter: str | None = Query(default=None, alias="status", description=f"One of {REPORT_STATUSES}"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if status_filter and status_filter not in REPORT_STATUSES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"status must be one of {REPORT_STATUSES}")
    return [_to_out(report, request) for report in ReportService(db, current_user).list_all(q, status_filter, limit, offset)]


@router.get("/copies", response_model=list[InspectionReportPair])
def list_report_pairs(request: Request, q: str = Query(default="", max_length=120),
                      limit: int = Query(default=50, ge=1, le=100),
                      offset: int = Query(default=0, ge=0, le=100000),
                      db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return [{"original": _to_out(original, request), "copy": _to_out(copy, request) if copy else None}
            for original, copy in ReportRepository(db).list_with_copies(q, limit, offset)]


@router.get("/{report_id}", response_model=InspectionReportDetail)
def get_report(
    report_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ReportService(db, current_user)
    report = _get_report_or_404(service, report_id)
    return _to_detail(report, request)


def _pdf_response(report_id: uuid.UUID, db: Session, current_user: User, disposition: str) -> Response:
    # Fetching report.url directly from the browser fails silently: the R2
    # bucket has no CORS policy for the frontend's origin, so fetch()/blob
    # downloads are blocked. Proxying the bytes through the API (same origin
    # as the app) lets us control Content-Disposition: "attachment" gives a
    # real download, "inline" opens the PDF in the browser's viewer.
    service = ReportService(db, current_user)
    report = _get_report_or_404(service, report_id)
    content = service.get_pdf_bytes(report)
    if not content:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report PDF not found.")

    filename = f"{report.registration_number or report.vehicle_title or 'inspection-report'}.pdf"
    safe_filename = "".join(c for c in filename if c.isalnum() or c in " ._-") or "inspection-report.pdf"
    return Response(
        content=content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'{disposition}; filename="{safe_filename}"',
            # The blanket default-src 'none' policy stops browsers' built-in PDF viewer.
            "Content-Security-Policy": "frame-ancestors 'none'",
        },
    )


@router.get("/{report_id}/download")
def download_report_pdf(
    report_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _pdf_response(report_id, db, current_user, "attachment")


@router.get("/{report_id}/view")
def view_report_pdf(
    report_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _pdf_response(report_id, db, current_user, "inline")


@router.put("/{report_id}", response_model=InspectionReportOut)
def update_report(
    report_id: uuid.UUID,
    payload: InspectionReportUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    service = ReportService(db, current_user)
    report = _get_report_or_404(service, report_id, True)
    try:
        report = service.update_fields(report, **payload.model_dump())
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    return _to_out(report, request)


@router.post("/{report_id}/scan2", response_model=InspectionReportOut, status_code=status.HTTP_201_CREATED)
def create_scan2_report(
    report_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ReportService(db, current_user)
    report = _get_report_or_404(service, report_id, True)
    try:
        copy = service.create_scan2(report, created_by=current_user.id, technician_name=current_user.full_name)
    except FileExistsError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return _to_out(copy, request)


@router.patch("/{report_id}/status", response_model=InspectionReportOut)
def update_report_status(
    report_id: uuid.UUID,
    payload: InspectionReportStatusUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    service = ReportService(db, current_user)
    report = _get_report_or_404(service, report_id, True)
    report = service.set_status(report, payload.status)
    return _to_out(report, request)


@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_report(
    report_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ReportService(db, current_user)
    report = _get_report_or_404(service, report_id, True)
    if not is_owner_level(current_user):
        if report.status != STATUS_PENDING:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only pending reports can be deleted before the owner reviews them.",
            )
        if report.created_by != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only delete your own reports.")
    service.delete(report)
