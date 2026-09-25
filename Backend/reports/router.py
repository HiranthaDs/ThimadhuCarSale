import json
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, Response, UploadFile, status
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user, require_owner
from auth.model import User
from core.database import get_db
from reports.model import REPORT_STATUSES, STATUS_PENDING
from reports.schema import InspectionReportDetail, InspectionReportOut, InspectionReportStatusUpdate, InspectionReportUpdate
from reports.service import ReportService

router = APIRouter(prefix="/reports", tags=["reports"])


def _to_out(report, request: Request) -> InspectionReportOut:
    out = InspectionReportOut.model_validate(report)
    if out.url.startswith("/"):
        out.url = str(request.base_url).rstrip("/") + out.url
    return out


def _to_detail(report, request: Request) -> InspectionReportDetail:
    out = InspectionReportDetail.model_validate(report)
    if out.url.startswith("/"):
        out.url = str(request.base_url).rstrip("/") + out.url
    return out


def _get_report_or_404(service: ReportService, report_id: uuid.UUID):
    report = service.get(report_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inspection report not found.")
    return report


@router.post("/pdf", response_model=InspectionReportOut, status_code=status.HTTP_201_CREATED)
async def upload_report_pdf(
    request: Request,
    file: UploadFile = File(...),
    registration_number: str | None = Form(default=None),
    vehicle_title: str | None = Form(default=None),
    buyer_name: str | None = Form(default=None),
    form_data: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only PDF files are accepted.")

    parsed_form_data = await _parse_form_data(form_data)

    content = await file.read()
    report = ReportService(db).upload_pdf(
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
        return json.loads(await form_data.read())
    except (TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid form_data payload.")


@router.put("/{report_id}/pdf", response_model=InspectionReportOut)
async def replace_report_pdf(
    report_id: uuid.UUID,
    request: Request,
    file: UploadFile = File(...),
    registration_number: str | None = Form(default=None),
    vehicle_title: str | None = Form(default=None),
    buyer_name: str | None = Form(default=None),
    form_data: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only PDF files are accepted.")

    service = ReportService(db)
    report = _get_report_or_404(service, report_id)
    parsed_form_data = await _parse_form_data(form_data)

    content = await file.read()
    try:
        report = service.replace_pdf(
            report,
            content,
            registration_number=registration_number,
            vehicle_title=vehicle_title,
            buyer_name=buyer_name,
            technician_name=current_user.full_name,
            form_data=parsed_form_data,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    return _to_out(report, request)


@router.get("/", response_model=list[InspectionReportOut])
def list_reports(
    request: Request,
    q: str | None = Query(default=None, description="Search by registration number, vehicle, buyer or technician"),
    status_filter: str | None = Query(default=None, alias="status", description=f"One of {REPORT_STATUSES}"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if status_filter and status_filter not in REPORT_STATUSES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"status must be one of {REPORT_STATUSES}")
    return [_to_out(report, request) for report in ReportService(db).list_all(q, status_filter)]


@router.get("/{report_id}", response_model=InspectionReportDetail)
def get_report(
    report_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ReportService(db)
    report = _get_report_or_404(service, report_id)
    return _to_detail(report, request)


@router.get("/{report_id}/download")
def download_report_pdf(
    report_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Fetching report.url directly from the browser fails silently: the R2
    # bucket has no CORS policy for the frontend's origin, so fetch()/blob
    # downloads are blocked. Proxying the bytes through the API (same origin
    # as the app) with a Content-Disposition header gives a real download.
    service = ReportService(db)
    report = _get_report_or_404(service, report_id)
    content = service.get_pdf_bytes(report)
    if not content:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report PDF not found.")

    filename = f"{report.registration_number or report.vehicle_title or 'inspection-report'}.pdf"
    safe_filename = "".join(c for c in filename if c.isalnum() or c in " ._-") or "inspection-report.pdf"
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_filename}"'},
    )


@router.put("/{report_id}", response_model=InspectionReportOut)
def update_report(
    report_id: uuid.UUID,
    payload: InspectionReportUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    service = ReportService(db)
    report = _get_report_or_404(service, report_id)
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
    service = ReportService(db)
    report = _get_report_or_404(service, report_id)
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
    service = ReportService(db)
    report = _get_report_or_404(service, report_id)
    report = service.set_status(report, payload.status)
    return _to_out(report, request)


@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_report(
    report_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ReportService(db)
    report = _get_report_or_404(service, report_id)
    if current_user.role != "owner":
        if report.status != STATUS_PENDING:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only pending reports can be deleted before the owner reviews them.",
            )
        if report.created_by != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only delete your own reports.")
    service.delete(report)
