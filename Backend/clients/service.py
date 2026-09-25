import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from activity.service import ActivityLogService
from auth.model import User, UserRole
from clients.model import ClientProfileStatus
from clients.repository import ClientProfileRepository
from clients.schema import IMAGE_FIELDS, ClientProfileCreate, ClientProfileUpdate
from core.media import decode_data_url
from core.r2_client import delete_client_document, upload_client_document

# scan_report_1/2_image are picked from an already-uploaded inspection report
# PDF (owned by the reports feature) rather than being uploaded here, so they
# must never be offloaded or cleaned up as if they were this profile's own
# document.
CLIENT_DOCUMENT_FIELDS = tuple(f for f in IMAGE_FIELDS if not f.startswith("scan_report_"))


def _offload_documents(data: dict) -> dict:
    """Upload any base64 document/photo fields to R2, replacing them with URLs."""
    for field in CLIENT_DOCUMENT_FIELDS:
        value = data.get(field)
        if not value:
            continue
        decoded = decode_data_url(value)
        if decoded:
            content_type, content = decoded
            data[field] = upload_client_document(content, content_type)
    return data


def _display_names(profile) -> str:
    names = [n for n in (profile.local_client_name, profile.foreign_client_name) if n]
    return " & ".join(names) if names else "Unnamed client"


class ClientProfileService:
    def __init__(self, db: Session):
        self.db = db
        self.repository = ClientProfileRepository(db)

    def create(self, payload: ClientProfileCreate, current_user: User):
        data = _offload_documents(payload.model_dump())
        profile = self.repository.create(created_by=current_user.id, **data)
        ActivityLogService(self.db).log(
            actor=current_user,
            action="client.create",
            entity_type="client_profile",
            entity_id=profile.id,
            description=f"Created client profile for {_display_names(profile)}",
        )
        return profile

    def list_all(self, q: str | None = None):
        return self.repository.list_all(q)

    def get(self, profile_id: uuid.UUID):
        profile = self.repository.get_by_id(profile_id)
        if not profile:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client profile not found.")
        return profile

    def update(self, profile_id: uuid.UUID, payload: ClientProfileUpdate, current_user: User):
        profile = self.get(profile_id)
        if profile.status == ClientProfileStatus.approved and current_user.role != UserRole.owner:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This profile is approved and can only be edited by the owner.",
            )
        old_documents = {field: getattr(profile, field) for field in CLIENT_DOCUMENT_FIELDS}
        data = _offload_documents(payload.model_dump())
        updated = self.repository.update(profile, **data)
        for field in CLIENT_DOCUMENT_FIELDS:
            old_url = old_documents.get(field)
            if old_url and old_url != data.get(field):
                delete_client_document(old_url)
        ActivityLogService(self.db).log(
            actor=current_user,
            action="client.update",
            entity_type="client_profile",
            entity_id=updated.id,
            description=f"Updated client profile for {_display_names(updated)}",
        )
        return updated

    def approve(self, profile_id: uuid.UUID, current_user: User):
        profile = self.get(profile_id)

        if current_user.role == UserRole.accountant:
            if profile.status != ClientProfileStatus.pending_accountant:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This profile has already passed accountant review.",
                )
            next_status = ClientProfileStatus.pending_owner
            action = "client.accountant_approve"
            description = f"Accountant approved client profile for {_display_names(profile)}"
        elif current_user.role == UserRole.owner:
            if profile.status != ClientProfileStatus.pending_owner:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This profile is awaiting accountant approval first.",
                )
            next_status = ClientProfileStatus.approved
            action = "client.owner_approve"
            description = f"Owner approved client profile for {_display_names(profile)}"
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the accountant or owner can approve client profiles.",
            )

        updated = self.repository.update(profile, status=next_status)
        ActivityLogService(self.db).log(
            actor=current_user,
            action=action,
            entity_type="client_profile",
            entity_id=updated.id,
            description=description,
        )
        return updated

    def delete(self, profile_id: uuid.UUID, current_user: User):
        profile = self.get(profile_id)
        client_name = _display_names(profile)
        document_urls = [getattr(profile, field) for field in CLIENT_DOCUMENT_FIELDS]
        self.repository.delete(profile)
        for url in document_urls:
            delete_client_document(url)
        ActivityLogService(self.db).log(
            actor=current_user,
            action="client.delete",
            entity_type="client_profile",
            entity_id=profile_id,
            description=f"Deleted client profile for {client_name}",
        )
