import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from auth.dependencies import require_owner
from auth.model import User
from clients.schema import ClientProfileCreate, ClientProfileOut, ClientProfileSummary
from clients.service import ClientProfileService
from core.database import get_db

router = APIRouter(prefix="/clients", tags=["clients"])


@router.post("/", response_model=ClientProfileOut, status_code=status.HTTP_201_CREATED)
def create_client_profile(
    payload: ClientProfileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    return ClientProfileService(db).create(payload, current_user)


@router.get("/", response_model=list[ClientProfileSummary])
def list_client_profiles(
    q: str | None = Query(default=None, description="Search across name, phone, NIC, vehicle number, etc."),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    return ClientProfileService(db).list_all(q)


@router.get("/{profile_id}", response_model=ClientProfileOut)
def get_client_profile(
    profile_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(require_owner)
):
    return ClientProfileService(db).get(profile_id)


@router.delete("/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_client_profile(
    profile_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(require_owner)
):
    ClientProfileService(db).delete(profile_id, current_user)
