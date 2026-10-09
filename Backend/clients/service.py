import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select
from reports.model import InspectionReport

from activity.service import ActivityLogService
from core.approvals import approval_entry, approved_roles
from auth.model import ROLE_LABELS, User, UserRole, is_owner_level
from clients.model import ClientProfileStatus
from clients.repository import ClientProfileRepository
from clients.schema import IMAGE_FIELDS, ClientProfileCreate, ClientProfileUpdate
from core.media import decode_data_url, join_images, split_images
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
        stored = []
        for image in split_images(value):
            decoded = decode_data_url(image)
            if decoded:
                content_type, content = decoded
                stored.append(upload_client_document(content, content_type))
            else:
                stored.append(existing_reference(image, allowed))
        data[field] = join_images(stored)
    return data


def _display_names(profile) -> str:
    names = [n for n in (profile.local_client_name, profile.foreign_client_name) if n]
    return " & ".join(names) if names else "Unnamed client"


class ClientProfileService:
    def __init__(self, db: Session):
        self.db = db
        self.repository = ClientProfileRepository(db)

    def prepare_documents(self, data, profile=None):
        allowed = [image for field in CLIENT_DOCUMENT_FIELDS for image in split_images(getattr(profile, field))] if profile else []
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

    # ---- Approvals: every role with the Approve tick, then the owner ----

    def _approver_roles(self) -> list[str]:
        from permissions.service import PermissionService

        return PermissionService(self.db).approver_roles()

    def _fresh_review(self) -> dict:
        """Status for new or edited content: wait for the approver roles, or go
        straight to the owner when nobody has the Approve tick."""
        status_ = ClientProfileStatus.pending_ceo if self._approver_roles() else ClientProfileStatus.pending_owner
        return {"status": status_, "role_approvals": []}

    def annotate(self, profiles, required: list[str] | None = None):
        """Set `waiting_for` on each profile: the roles that still need to approve."""
        required = self._approver_roles() if required is None else required
        for profile in profiles:
            done = approved_roles(profile.role_approvals)
            profile.waiting_for = (
                [role for role in required if role not in done]
                if profile.status == ClientProfileStatus.pending_ceo else []
            )
        return profiles

    def advance_ready_profiles(self):
        """Move profiles on to the owner once no approver role is still missing,
        e.g. after the owner removes the last person who could approve for a role."""
        required = set(self._approver_roles())
        changed = False
        for profile in self.repository.list_by_status(ClientProfileStatus.pending_ceo):
            if required <= approved_roles(profile.role_approvals):
                profile.status = ClientProfileStatus.pending_owner
                changed = True
        if changed:
            self.db.commit()

    def create(self, payload: ClientProfileCreate, current_user: User):
        data = self.prepare_documents(payload.model_dump())
        profile = self.repository.create(created_by=current_user.id, **data, **self._fresh_review())
        ActivityLogService(self.db).log(
            actor=current_user,
            action="client.create",
            entity_type="client_profile",
            entity_id=profile.id,
            description=f"Created client profile for {_display_names(profile)}",
        )
        return self.annotate([profile])[0]

    def list_all(self, q: str | None = None, limit=100, offset=0, status_filter=None, awaiting: User | None = None):
        """`awaiting`: only the profiles waiting for this user's approval."""
        required = self._approver_roles()
        if awaiting is None:
            profiles = self.repository.list_all(q, limit, offset, status_filter)
        elif awaiting.role == UserRole.owner:
            profiles = self.repository.list_all(q, limit, offset, ClientProfileStatus.pending_owner)
        elif awaiting.role.value in required:
            pending = self.annotate(self.repository.list_all(q, None, 0, ClientProfileStatus.pending_ceo), required)
            profiles = [p for p in pending if awaiting.role.value in p.waiting_for][offset:offset + limit]
        else:
            profiles = []
        return self.annotate(profiles, required)

    def get(self, profile_id: uuid.UUID):
        profile = self.repository.get_by_id(profile_id)
        if not profile:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client profile not found.")
        return self.annotate([profile])[0]

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
        # Any edited content must go through every approval again.
        data.update(self._fresh_review())
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
        return self.annotate([updated])[0]

    def approve(self, profile_id: uuid.UUID, current_user: User):
        profile = self.repository.get_by_id(profile_id, lock=True)
        if not profile:
            raise HTTPException(404, "Client profile not found.")

        # The router has already checked the "clients.approve" permission. Every
        # role with that permission approves first, then the owner gives the
        # final approval.
        self.annotate([profile])
        if current_user.role == UserRole.owner:
            if profile.status != ClientProfileStatus.pending_owner:
                waiting = ", ".join(ROLE_LABELS.get(r, r) for r in profile.waiting_for)
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"This profile is still waiting for approval from: {waiting}."
                    if waiting else "This profile is already approved.",
                )
            changes = {"status": ClientProfileStatus.approved}
            action = "client.owner_approve"
            description = f"Owner approved client profile for {_display_names(profile)}"
        else:
            role = current_user.role.value
            if role not in profile.waiting_for:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This profile isn't waiting for your approval.",
                )
            remaining = [r for r in profile.waiting_for if r != role]
            changes = {"role_approvals": [*(profile.role_approvals or []), approval_entry(current_user)]}
            if not remaining:
                changes["status"] = ClientProfileStatus.pending_owner
            action = f"client.{role}_approve"
            description = f"{ROLE_LABELS.get(role, role)} approved client profile for {_display_names(profile)}"

        updated = self.repository.update(profile, **changes)
        ActivityLogService(self.db).log(
            actor=current_user,
            action=action,
            entity_type="client_profile",
            entity_id=updated.id,
            description=description,
        )
        return self.annotate([updated])[0]

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
