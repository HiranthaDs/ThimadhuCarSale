import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from auth.dependencies import require_owner, require_roles
from auth.model import User, UserRole
from blacklist.schema import VehicleBlacklistCreate, VehicleBlacklistOut, VehicleBlacklistUpdate
from blacklist.service import VehicleBlacklistService
from core.database import get_db

router = APIRouter(prefix="/blacklist", tags=["blacklist"])

require_blacklist_access = require_roles(UserRole.owner, UserRole.ceo, UserRole.accountant, UserRole.technician)


@router.post("/", response_model=VehicleBlacklistOut, status_code=status.HTTP_201_CREATED)
def create_blacklist_entry(
    payload: VehicleBlacklistCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_blacklist_access),
):
    return VehicleBlacklistService(db).create(payload, current_user)


@router.get("/", response_model=list[VehicleBlacklistOut])
def list_blacklist_entries(
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0, le=100000),
    q: str | None = Query(default=None, max_length=120, description="Search across vehicle number, chassis number, remarks."),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_blacklist_access),
):
    return VehicleBlacklistService(db).list_all(q, limit, offset)


@router.get("/{entry_id}", response_model=VehicleBlacklistOut)
def get_blacklist_entry(
    entry_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(require_blacklist_access)
):
    return VehicleBlacklistService(db).get(entry_id)


@router.put("/{entry_id}", response_model=VehicleBlacklistOut)
def update_blacklist_entry(
    entry_id: uuid.UUID,
    payload: VehicleBlacklistUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_blacklist_access),
):
    return VehicleBlacklistService(db).update(entry_id, payload, current_user)


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_blacklist_entry(
    entry_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(require_owner)
):
    VehicleBlacklistService(db).delete(entry_id, current_user)
