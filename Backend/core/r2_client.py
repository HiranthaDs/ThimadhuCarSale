import json
import threading
import time
import uuid
from datetime import datetime, timezone
from urllib.parse import unquote, urlsplit
from fastapi import HTTPException
from pydantic import BaseModel, model_serializer

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

from core.config import get_settings

_settings = get_settings()

_client = boto3.client(
    "s3",
    endpoint_url=f"https://{_settings.r2_account_id}.r2.cloudflarestorage.com",
    aws_access_key_id=_settings.r2_access_key_id,
    aws_secret_access_key=_settings.r2_secret_access_key,
    config=Config(signature_version="s3v4", connect_timeout=5, read_timeout=20,
                  retries={"max_attempts": 2}, max_pool_connections=20,
                  s3={"addressing_style": "path"}),
    region_name="auto",
)

REPORTS_BUCKET = _settings.r2_reports_bucket
REPORTS_PUBLIC_URL = _settings.r2_reports_public_url.rstrip("/")
BLACKLIST_BUCKET = _settings.r2_blacklist_bucket
BLACKLIST_PUBLIC_URL = _settings.r2_blacklist_public_url.rstrip("/")

_USAGE_CACHE_SECONDS = 300
_usage_cache_lock = threading.Lock()
_usage_cache = {"expires_at": 0.0, "value": None}


def _invalidate_usage_cache() -> None:
    with _usage_cache_lock:
        _usage_cache["expires_at"] = 0.0


def storage_usage() -> dict:
    """Return the current object storage size for this app's configured R2 buckets."""
    now = time.monotonic()
    with _usage_cache_lock:
        if _usage_cache["value"] is not None and now < _usage_cache["expires_at"]:
            return dict(_usage_cache["value"])

    buckets = list(dict.fromkeys(bucket for bucket in (REPORTS_BUCKET, BLACKLIST_BUCKET) if bucket))
    if not buckets:
        raise RuntimeError("R2 buckets are not configured.")

    used_bytes = 0
    object_count = 0
    for bucket in buckets:
        paginator = _client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=bucket):
            for item in page.get("Contents", []):
                used_bytes += item.get("Size", 0)
                object_count += 1

    included_bytes = 10_000_000_000  # Cloudflare R2 Standard monthly free storage allowance: 10 GB-month.
    value = {
        "used_bytes": used_bytes,
        "object_count": object_count,
        "included_free_bytes": included_bytes,
        "remaining_included_bytes": max(0, included_bytes - used_bytes),
        "bucket_count": len(buckets),
        "measured_at": datetime.now(timezone.utc).isoformat(),
    }
    with _usage_cache_lock:
        _usage_cache["value"] = value
        _usage_cache["expires_at"] = time.monotonic() + _USAGE_CACHE_SECONDS
    return dict(value)


def _put(bucket: str, key: str, content: bytes, content_type: str) -> None:
    _client.put_object(Bucket=bucket, Key=key, Body=content, ContentType=content_type)
    _invalidate_usage_cache()


def _delete(bucket: str, key: str) -> None:
    _client.delete_object(Bucket=bucket, Key=key)
    _invalidate_usage_cache()


def _key_from_url(public_base: str, url: str | None) -> str | None:
    if not url or not url.startswith(public_base + "/"):
        return None
    return url[len(public_base) + 1 :]


def _ext_for_content_type(content_type: str) -> str:
    ext = (content_type.rsplit("/", 1)[-1] or "bin").lower()
    return "jpg" if ext == "jpeg" else ext


# --- Inspection report PDFs -------------------------------------------------


def upload_report_pdf(content: bytes, public_id: str) -> str:
    key = f"reports/{uuid.uuid4().hex}.pdf"
    _put(REPORTS_BUCKET, key, content, "application/pdf")
    return f"r2://reports/{key}"


def delete_report_pdf(url: str | None) -> None:
    """Retain immutable files; deletion is reserved for reference-aware maintenance."""
    return None


def get_report_pdf_bytes(url: str | None) -> bytes:
    reference = storage_reference(url)
    key = reference[1] if reference and reference[0] == REPORTS_BUCKET else None
    if not key:
        return b""
    response = _client.get_object(Bucket=REPORTS_BUCKET, Key=key)
    with response["Body"] as body:
        content = body.read(_settings.max_report_pdf_bytes + 1)
    if len(content) > _settings.max_report_pdf_bytes:
        raise HTTPException(413, "Document exceeds the file limit.")
    return content


CLIENT_DOCUMENT_PREFIX = "client-documents"


def upload_client_document(content: bytes, content_type: str) -> str:
    key = f"{CLIENT_DOCUMENT_PREFIX}/{uuid.uuid4().hex}.{_ext_for_content_type(content_type)}"
    _put(REPORTS_BUCKET, key, content, content_type)
    return f"r2://reports/{key}"


def get_client_document_bytes(value: str) -> bytes:
    reference = storage_reference(value)
    if not reference or reference[0] != REPORTS_BUCKET or not reference[1].startswith(CLIENT_DOCUMENT_PREFIX + "/"):
        raise ValueError("This is not a client document.")
    response = _client.get_object(Bucket=REPORTS_BUCKET, Key=reference[1])
    with response["Body"] as body:
        content = body.read(_settings.max_file_bytes + 1)
    if len(content) > _settings.max_file_bytes:
        raise ValueError("Client document exceeds the file limit.")
    return content


def delete_client_document(url: str | None) -> None:
    """Retain immutable files; deletion is reserved for reference-aware maintenance."""
    return None

FORM_ATTACHMENT_PREFIX = "form-attachments"


def upload_form_attachment(content: bytes, content_type: str) -> str:
    key = f"{FORM_ATTACHMENT_PREFIX}/{uuid.uuid4().hex}.{_ext_for_content_type(content_type)}"
    _put(REPORTS_BUCKET, key, content, content_type)
    return f"r2://reports/{key}"


def delete_form_attachment(url: str | None) -> None:
    """Retain immutable files; deletion is reserved for reference-aware maintenance."""
    return None


# --- Blacklist vehicle images ------------------------------------------------


def upload_blacklist_image(content: bytes, content_type: str) -> str:
    key = f"{uuid.uuid4().hex}.{_ext_for_content_type(content_type)}"
    _put(BLACKLIST_BUCKET, key, content, content_type)
    return f"r2://blacklist/{key}"


def delete_blacklist_image(url: str | None) -> None:
    """Retain immutable files; deletion is reserved for reference-aware maintenance."""
    return None


def storage_reference(value: str | None) -> tuple[str, str] | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = urlsplit(value)
    except ValueError:
        return None
    key = None
    bucket = None
    if parsed.scheme == "r2" and parsed.netloc in ("reports", "blacklist"):
        bucket = REPORTS_BUCKET if parsed.netloc == "reports" else BLACKLIST_BUCKET
        key = unquote(parsed.path.lstrip("/"))
    elif parsed.scheme == "https":
        clean = value.split("?", 1)[0]
        for base, candidate in ((REPORTS_PUBLIC_URL, REPORTS_BUCKET), (BLACKLIST_PUBLIC_URL, BLACKLIST_BUCKET)):
            if base and clean.startswith(base + "/"):
                bucket, key = candidate, unquote(clean[len(base) + 1:])
                break
        endpoint = f"{_settings.r2_account_id}.r2.cloudflarestorage.com"
        if parsed.netloc == endpoint:
            parts = unquote(parsed.path).lstrip("/").split("/", 1)
            if len(parts) == 2 and parts[0] in (REPORTS_BUCKET, BLACKLIST_BUCKET):
                bucket, key = parts
    if not bucket or not key or any(p in ("", ".", "..") for p in key.split("/")) or chr(92) in key:
        return None
    return bucket, key


def canonical_url(value: str) -> str:
    reference = storage_reference(value)
    if not reference:
        return value
    bucket, key = reference
    return "r2://" + ("reports" if bucket == REPORTS_BUCKET else "blacklist") + "/" + key


def private_url(value):
    reference = storage_reference(value)
    if not reference:
        return value
    bucket, key = reference
    return _client.generate_presigned_url(
        "get_object", Params={"Bucket": bucket, "Key": key,
                             "ResponseContentDisposition": "inline",
                             **({"ResponseContentType": "application/pdf"} if key.lower().endswith(".pdf") else {})},
        ExpiresIn=_settings.private_download_seconds,
    )


def private_values(value):
    if isinstance(value, str):
        if value.startswith("[\""):
            try:
                items = json.loads(value)
            except ValueError:
                items = None
            if isinstance(items, list) and all(isinstance(i, str) for i in items):
                return json.dumps([private_url(i) for i in items])
        return private_url(value)
    if isinstance(value, dict):
        return {k: private_values(v) for k, v in value.items()}
    if isinstance(value, list):
        return [private_values(v) for v in value]
    return value


class PrivateMediaResponse(BaseModel):
    @model_serializer(mode="wrap")
    def serialize_private_media(self, handler):
        return private_values(handler(self))


def existing_reference(value, allowed):
    canonical = canonical_url(value)
    if storage_reference(canonical) and canonical in {canonical_url(v) for v in allowed if v}:
        return canonical
    raise HTTPException(400, "This attachment does not belong to this record. Upload the file again.")
