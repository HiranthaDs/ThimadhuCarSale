import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from auth.dependencies import require_owner, require_owner_co_accountant, require_roles
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
from core.r2_client import find_scan_reports, list_report_pdfs
from core.database import get_db

router = APIRouter(prefix="/clients", tags=["clients"])


@router.post("/", response_model=ClientProfileOut, status_code=status.HTTP_201_CREATED)
def create_client_profile(
    payload: ClientProfileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_co_accountant),
):
    return ClientProfileService(db).create(payload, current_user)


@router.get("/", response_model=list[ClientProfileSummary])
def list_client_profiles(
    q: str | None = Query(default=None, description="Search across name, phone, NIC, vehicle number, etc."),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_co_accountant),
):
    return ClientProfileService(db).list_all(q)


@router.get("/scan-reports/lookup", response_model=ScanReportLookup)
def lookup_scan_reports(
    vehicle_number: str = Query(..., min_length=1),
    current_user: User = Depends(require_owner_co_accountant),
):
    return find_scan_reports(vehicle_number)


@router.get("/scan-reports/all", response_model=list[ScanReportSearchResult])
def list_all_scan_reports(
    current_user: User = Depends(require_owner_co_accountant),
):
    return list_report_pdfs()


@router.get("/{profile_id}", response_model=ClientProfileOut)
def get_client_profile(
    profile_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(require_owner_co_accountant)
):
    return ClientProfileService(db).get(profile_id)


@router.put("/{profile_id}", response_model=ClientProfileOut)
def update_client_profile(
    profile_id: uuid.UUID,
    payload: ClientProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_co_accountant),
):
    return ClientProfileService(db).update(profile_id, payload, current_user)


@router.patch("/{profile_id}/approve", response_model=ClientProfileOut)
def approve_client_profile(
    profile_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.owner, UserRole.accountant)),
):
    return ClientProfileService(db).approve(profile_id, current_user)


@router.delete("/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_client_profile(
    profile_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(require_owner)
):
    ClientProfileService(db).delete(profile_id, current_user)
