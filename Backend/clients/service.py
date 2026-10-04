import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select
from reports.model import InspectionReport

from activity.service import ActivityLogService
from auth.model import User, UserRole, is_owner_level
from clients.model import ClientProfileStatus
from clients.repository import ClientProfileRepository
from clients.schema import IMAGE_FIELDS, ClientProfileCreate, ClientProfileUpdate
from core.media import decode_data_url
from core.r2_client import delete_client_document, upload_client_document, existing_reference, canonical_url

# scan_report_1/2_image are picked from an already-uploaded inspection report
# PDF (owned by the reports feature) rather than being uploaded here, so they
# must never be offloaded or cleaned up as if they were this profile's own
# document. scan_report_1/2_upload are separate PDF/image uploads made on this
# form, so they are offloaded like any other document field.
CLIENT_DOCUMENT_FIELDS = tuple(
    f for f in IMAGE_FIELDS if f not in ("scan_report_1_image", "scan_report_2_image")
)


def _offload_documents(data: dict, allowed=()) -> dict:
    """Upload any base64 document/photo fields to R2, replacing them with URLs."""
    for field in CLIENT_DOCUMENT_FIELDS:
        value = data.get(field)
        if not value:
            continue
        decoded = decode_data_url(value)
        if decoded:
            content_type, content = decoded
            data[field] = upload_client_document(content, content_type)
        else:
            data[field] = existing_reference(value, allowed)
    return data


def _display_names(profile) -> str:
    names = [n for n in (profile.local_client_name, profile.foreign_client_name) if n]
    return " & ".join(names) if names else "Unnamed client"


class ClientProfileService:
    def __init__(self, db: Session):
        self.db = db
        self.repository = ClientProfileRepository(db)

    def prepare_documents(self, data, profile=None):
        allowed = [getattr(profile, field) for field in CLIENT_DOCUMENT_FIELDS] if profile else []
        data = _offload_documents(data, allowed)
        for field in ("scan_report_1_image", "scan_report_2_image"):
            value = data.get(field)
            if value:
                canonical = canonical_url(value)
                # Match an actual report, never an arbitrary object in the bucket.
                from core.r2_client import storage_reference
                reference = storage_reference(canonical)
                if not reference:
                    raise HTTPException(400, "Choose a saved inspection report.")
                key = reference[1]
                reports = self.db.scalars(select(InspectionReport).where(
                    InspectionReport.url.endswith(key)
                ))
                if not any(canonical_url(report.url) == canonical for report in reports):
                    raise HTTPException(400, "Inspection report not found.")
                data[field] = canonical
        return data

    def create(self, payload: ClientProfileCreate, current_user: User):
        data = self.prepare_documents(payload.model_dump())
        profile = self.repository.create(created_by=current_user.id, **data)
        ActivityLogService(self.db).log(
            actor=current_user,
            action="client.create",
            entity_type="client_profile",
            entity_id=profile.id,
            description=f"Created client profile for {_display_names(profile)}",
        )
        return profile

    def list_all(self, q: str | None = None, limit=100, offset=0, status_filter=None):
        return self.repository.list_all(q, limit, offset, status_filter)

    def get(self, profile_id: uuid.UUID):
        profile = self.repository.get_by_id(profile_id)
        if not profile:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client profile not found.")
        return profile

    def update(self, profile_id: uuid.UUID, payload: ClientProfileUpdate, current_user: User):
        profile = self.repository.get_by_id(profile_id, lock=True)
        if not profile:
            raise HTTPException(404, "Client profile not found.")
        if profile.status == ClientProfileStatus.approved and not is_owner_level(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This profile is approved and can only be edited by the owner or CEO.",
            )
        old_documents = {field: getattr(profile, field) for field in CLIENT_DOCUMENT_FIELDS}
        data = self.prepare_documents(payload.model_dump(), profile)
        # Any edited content must go through both approvals again.
        if profile.status != ClientProfileStatus.pending_accountant:
            data["status"] = ClientProfileStatus.pending_accountant
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
        profile = self.repository.get_by_id(profile_id, lock=True)
        if not profile:
            raise HTTPException(404, "Client profile not found.")

        if current_user.role == UserRole.accountant:
            if profile.status != ClientProfileStatus.pending_accountant:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This profile has already passed accountant review.",
                )
            next_status = ClientProfileStatus.pending_owner
            action = "client.accountant_approve"
            description = f"Accountant approved client profile for {_display_names(profile)}"
        elif is_owner_level(current_user):
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
                detail="Only the accountant, owner or CEO can approve client profiles.",
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
