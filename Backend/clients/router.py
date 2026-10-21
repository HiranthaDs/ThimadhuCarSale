import io
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from PIL import Image, ImageOps, UnidentifiedImageError
from botocore.exceptions import ClientError
from sqlalchemy.orm import Session

from auth.dependencies import require_owner, require_permission
from auth.model import User
from clients.schema import (
    ClientProfileCreate,
    ClientProfileOut,
    ClientProfileSummary,
    ClientProfileUpdate,
    ScanReportLookup,
    ScanReportSearchResult,
)
from clients.service import ClientProfileService
from clients.model import ClientProfileFormSchema, ClientProfileStatus
from clients.schema import IMAGE_FIELDS
from core.media import split_images
from core.r2_client import get_client_document_bytes
from sqlalchemy import select
from reports.model import InspectionReport
from reports.repository import ReportRepository
from core.database import get_db

router = APIRouter(prefix="/clients", tags=["clients"])

CUSTOM_FIELD_TYPES = {"text", "email", "tel", "number", "date", "textarea", "checkbox", "radio", "select", "image", "multi_image", "file"}
CUSTOM_FIELD_TABS = {"client_details", "document", "previous_owner", "department", "payment"}
BUILTIN_FIELD_LABELS = {
    "client_details": ("Local Client", "Client Name", "Phone Number", "Identification Document", "NIC", "Passport",
                       "Other document", "No document", "NIC Number", "NIC Photo", "Passport Number", "Passport Photo",
                       "Other document Number", "Other document Photo", "Handover Selfie", "Foreign Client", "Country"),
    "document": ("CR Document", "Revenue License", "Type", "Chassis Number", "Vehicle Number"),
    "previous_owner": ("Previous Owner Name", "NIC", "Phone Number", "Registration Status", "Detailed Selfie Photo",
                       "In-Writing Letter", "Inspection Report 1", "Inspection Report 2", "Scan Report 1 (Upload)",
                       "Scan Report 2 (Upload)", "Garage Bill", "Modification", "Others", "Third Person Involved?",
                       "Third Person Document", "Handover Selfie"),
    "department": ("Marketing", "Technical", "Purchasing", "Department", "Person's Name"),
    "payment": ("Leasing Company", "Bank Officer Name", "File Signed Date", "Payment Date", "DO Date",
                "Customer Advanced Date", "Vehicle Handover Date", "Purchasing Date", "Selling Price", "Loan Amount",
                "Customer Down Payment"),
}
BUILTIN_LABEL_KEYS = {f"{tab}:{label}" for tab, labels in BUILTIN_FIELD_LABELS.items() for label in labels}
SCALAR_FIELD_LABELS = {
    "client_details": ("Client Name", "Phone Number", "NIC Number", "Passport Number", "Other document Number"),
    "document": ("Type", "Chassis Number", "Vehicle Number"),
    "previous_owner": ("Previous Owner Name", "NIC", "Phone Number", "Others"),
    "department": ("Marketing", "Technical", "Purchasing", "Department", "Person's Name"),
    "payment": ("Leasing Company", "Bank Officer Name"),
}
SCALAR_FIELD_KEYS = {f"{tab}:{label}" for tab, labels in SCALAR_FIELD_LABELS.items() for label in labels}
SCALAR_INPUT_TYPES = {"text", "email", "tel", "number", "date", "textarea"}


@router.get("/form-schema")
def get_client_form_schema(db: Session = Depends(get_db), current_user: User = Depends(require_permission("clients.view", "clients.create", "clients.edit"))):
    saved = db.get(ClientProfileFormSchema, "default")
    return {"fields": saved.fields if saved else [], "labels": saved.labels if saved else {},
            "hidden_fields": saved.hidden_fields if saved else [], "field_types": saved.field_types if saved else {}}


@router.put("/form-schema")
def update_client_form_schema(payload: dict, db: Session = Depends(get_db), current_user: User = Depends(require_owner)):
    fields = payload.get("fields") if isinstance(payload, dict) else None
    if not isinstance(fields, list) or len(fields) > 100:
        raise HTTPException(400, "The form can have at most 100 custom fields.")
    keys = set()
    clean = []
    for field in fields:
        if not isinstance(field, dict):
            raise HTTPException(400, "Invalid form field.")
        key, label, tab, kind = (field.get(name) for name in ("key", "label", "tab", "type"))
        if (not isinstance(key, str) or not key.startswith("custom_") or len(key) > 80
                or not key.replace("_", "").isalnum() or key in keys
                or not isinstance(label, str) or not label.strip() or len(label) > 120
                or tab not in CUSTOM_FIELD_TABS or kind not in CUSTOM_FIELD_TYPES):
            raise HTTPException(400, "Every field needs a unique key, label, tab, and supported type.")
        options = field.get("options", [])
        if kind in ("radio", "select"):
            if (not isinstance(options, list) or not 1 <= len(options) <= 20
                    or any(not isinstance(v, str) or not v.strip() or len(v) > 80 for v in options)):
                raise HTTPException(400, "Radio and selection fields need 1 to 20 options.")
        keys.add(key)
        clean.append({"key": key, "label": label.strip(), "tab": tab, "type": kind,
                      "options": [v.strip() for v in options] if kind in ("radio", "select") else []})
    saved = db.get(ClientProfileFormSchema, "default")
    labels = payload.get("labels", saved.labels if saved else {})
    if (not isinstance(labels, dict) or len(labels) > len(BUILTIN_LABEL_KEYS)
            or any(key not in BUILTIN_LABEL_KEYS or not isinstance(value, str) or not value.strip() or len(value) > 120
                   for key, value in labels.items())):
        raise HTTPException(400, "Existing field labels must be non-empty and at most 120 characters.")
    clean_labels = {key: value.strip() for key, value in labels.items()}
    hidden = payload.get("hidden_fields", saved.hidden_fields if saved else [])
    if (not isinstance(hidden, list) or len(hidden) > len(BUILTIN_LABEL_KEYS)
            or any(not isinstance(key, str) or key not in BUILTIN_LABEL_KEYS for key in hidden)
            or len(hidden) != len(set(hidden))):
        raise HTTPException(400, "Removed fields must refer to existing client profile fields.")
    field_types = payload.get("field_types", saved.field_types if saved else {})
    if (not isinstance(field_types, dict) or len(field_types) > len(SCALAR_FIELD_KEYS)
            or any(key not in SCALAR_FIELD_KEYS or not isinstance(value, str) or value not in SCALAR_INPUT_TYPES
                   for key, value in field_types.items())):
        raise HTTPException(400, "An existing field cannot use that input type.")
    if saved:
        saved.fields = clean
        saved.labels = clean_labels
        saved.hidden_fields = hidden
        saved.field_types = field_types
    else:
        db.add(ClientProfileFormSchema(id="default", fields=clean, labels=clean_labels,
                                       hidden_fields=hidden, field_types=field_types))
    db.commit()
    return {"fields": clean, "labels": clean_labels, "hidden_fields": hidden, "field_types": field_types}


@router.post("/", response_model=ClientProfileOut, status_code=status.HTTP_201_CREATED)
def create_client_profile(
    payload: ClientProfileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("clients.create")),
):
    return ClientProfileService(db).create(payload, current_user)


@router.get("/", response_model=list[ClientProfileSummary])
def list_client_profiles(
    status_filter: ClientProfileStatus | None = Query(default=None, alias="status"),
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0, le=100000),
    q: str | None = Query(default=None, max_length=120, description="Search across name, phone, NIC, vehicle number, etc."),
    awaiting_me: bool = Query(default=False, description="Only profiles waiting for the caller's approval"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("clients.view")),
):
    return ClientProfileService(db).list_all(q, limit, offset, status_filter, current_user if awaiting_me else None)


@router.get("/scan-reports/lookup", response_model=ScanReportLookup)
def lookup_scan_reports(
    vehicle_number: str = Query(..., min_length=1, max_length=60),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("clients.create", "clients.edit")),
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
    current_user: User = Depends(require_permission("clients.create", "clients.edit")),
):
    reports = ReportRepository(db).list_all(q, limit=limit, offset=offset)
    return [{"public_id": str(r.id), "filename": (r.registration_number or str(r.id)) + ".pdf", "secure_url": r.url} for r in reports]


@router.get("/{profile_id}", response_model=ClientProfileOut)
def get_client_profile(
    profile_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(require_permission("clients.view"))
):
    return ClientProfileService(db).get(profile_id)


@router.get("/{profile_id}/finalized", response_model=ClientProfileOut)
def get_finalized_client_profile(
    profile_id: uuid.UUID, db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("clients.view")),
):
    profile = ClientProfileService(db).get(profile_id)
    if profile.status != ClientProfileStatus.approved:
        raise HTTPException(409, "The client profile must receive final owner approval before download.")
    return profile


@router.get("/{profile_id}/finalized-image/{field}/{image_index}")
def get_finalized_client_image(
    profile_id: uuid.UUID, field: str, image_index: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("clients.view")),
):
    profile = ClientProfileService(db).get(profile_id)
    if profile.status != ClientProfileStatus.approved:
        raise HTTPException(409, "The client profile must receive final owner approval before download.")
    if field in IMAGE_FIELDS and field not in ("scan_report_1_image", "scan_report_2_image"):
        value = getattr(profile, field)
    else:
        definition = next((item for item in profile.custom_field_schema or []
                           if item.get("key") == field and item.get("type") in ("image", "multi_image", "file")), None)
        if not definition:
            raise HTTPException(404, "Image not found.")
        value = (profile.custom_fields or {}).get(field)
    images = split_images(value)
    if image_index < 0 or image_index >= len(images):
        raise HTTPException(404, "Image not found.")
    try:
        content = get_client_document_bytes(images[image_index])
        with Image.open(io.BytesIO(content)) as image:
            image = ImageOps.exif_transpose(image)
            image.thumbnail((1400, 1400))
            output = io.BytesIO()
            image.convert("RGB").save(output, "JPEG", quality=82, optimize=True)
    except (ClientError, UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(404, "Image not found.") from None
    return Response(output.getvalue(), media_type="image/jpeg", headers={"Cache-Control": "private, no-store"})


@router.put("/{profile_id}", response_model=ClientProfileOut)
def update_client_profile(
    profile_id: uuid.UUID,
    payload: ClientProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("clients.edit")),
):
    return ClientProfileService(db).update(profile_id, payload, current_user)


@router.patch("/{profile_id}/approve", response_model=ClientProfileOut)
def approve_client_profile(
    profile_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("clients.approve")),
):
    return ClientProfileService(db).approve(profile_id, current_user)


@router.delete("/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_client_profile(
    profile_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(require_permission("clients.delete"))
):
    ClientProfileService(db).delete(profile_id, current_user)
