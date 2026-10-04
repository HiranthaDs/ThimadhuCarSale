import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from auth.dependencies import require_owner, require_owner_ceo_accountant, require_roles
from auth.model import User, UserRole
from clients.schema import (
    ClientProfileCreate,
    ClientProfileOut,
    ClientProfileSummary,
    ClientProfileUpdate,
    ScanReportLookup,
    ScanReportSearchResult,
)
from clients.service import ClientProfileService
from clients.model import ClientProfileStatus
from sqlalchemy import select
from reports.model import InspectionReport
from reports.repository import ReportRepository
from core.database import get_db

router = APIRouter(prefix="/clients", tags=["clients"])


@router.post("/", response_model=ClientProfileOut, status_code=status.HTTP_201_CREATED)
def create_client_profile(
    payload: ClientProfileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_ceo_accountant),
):
    return ClientProfileService(db).create(payload, current_user)


@router.get("/", response_model=list[ClientProfileSummary])
def list_client_profiles(
    status_filter: ClientProfileStatus | None = Query(default=None, alias="status"),
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0, le=100000),
    q: str | None = Query(default=None, max_length=120, description="Search across name, phone, NIC, vehicle number, etc."),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_ceo_accountant),
):
    return ClientProfileService(db).list_all(q, limit, offset, status_filter)


@router.get("/scan-reports/lookup", response_model=ScanReportLookup)
def lookup_scan_reports(
    vehicle_number: str = Query(..., min_length=1, max_length=60),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_ceo_accountant),
):
    repository = ReportRepository(db)
    first = repository.find_by_registration(vehicle_number.strip())
    second = (repository.find_by_registration(vehicle_number.strip() + "-Inspection Report 2")
              or repository.find_by_registration(vehicle_number.strip() + "-Scan2"))
    return {"scan_report_1_url": first.url if first else None, "scan_report_2_url": second.url if second else None}


@router.get("/scan-reports/all", response_model=list[ScanReportSearchResult])
def list_all_scan_reports(
    q: str = Query(default="", max_length=120),
    db: Session = Depends(get_db),
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0, le=100000),
    current_user: User = Depends(require_owner_ceo_accountant),
):
    reports = ReportRepository(db).list_all(q, limit=limit, offset=offset)
    return [{"public_id": str(r.id), "filename": (r.registration_number or str(r.id)) + ".pdf", "secure_url": r.url} for r in reports]


@router.get("/{profile_id}", response_model=ClientProfileOut)
def get_client_profile(
    profile_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(require_owner_ceo_accountant)
):
    return ClientProfileService(db).get(profile_id)


@router.put("/{profile_id}", response_model=ClientProfileOut)
def update_client_profile(
    profile_id: uuid.UUID,
    payload: ClientProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_ceo_accountant),
):
    return ClientProfileService(db).update(profile_id, payload, current_user)


@router.patch("/{profile_id}/approve", response_model=ClientProfileOut)
def approve_client_profile(
    profile_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.owner, UserRole.ceo, UserRole.accountant)),
):
    return ClientProfileService(db).approve(profile_id, current_user)


@router.delete("/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_client_profile(
    profile_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(require_owner)
):
    ClientProfileService(db).delete(profile_id, current_user)
