import uuid

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
    config=Config(signature_version="s3v4"),
    region_name="auto",
)

REPORTS_BUCKET = _settings.r2_reports_bucket
REPORTS_PUBLIC_URL = _settings.r2_reports_public_url.rstrip("/")
BLACKLIST_BUCKET = _settings.r2_blacklist_bucket
BLACKLIST_PUBLIC_URL = _settings.r2_blacklist_public_url.rstrip("/")


def _put(bucket: str, key: str, content: bytes, content_type: str) -> None:
    _client.put_object(Bucket=bucket, Key=key, Body=content, ContentType=content_type)


def _delete(bucket: str, key: str) -> None:
    _client.delete_object(Bucket=bucket, Key=key)


def _key_from_url(public_base: str, url: str | None) -> str | None:
    if not url or not url.startswith(public_base + "/"):
        return None
    return url[len(public_base) + 1 :]


# --- Inspection report PDFs -------------------------------------------------


def upload_report_pdf(content: bytes, public_id: str) -> str:
    key = f"{public_id}.pdf"
    _put(REPORTS_BUCKET, key, content, "application/pdf")
    return f"{REPORTS_PUBLIC_URL}/{key}"


def delete_report_pdf(url: str | None) -> None:
    key = _key_from_url(REPORTS_PUBLIC_URL, url)
    if key:
        _delete(REPORTS_BUCKET, key)


def list_report_pdfs(max_results: int = 500) -> list[dict]:
    paginator = _client.get_paginator("list_objects_v2")
    results = []
    for page in paginator.paginate(Bucket=REPORTS_BUCKET):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            if not key.lower().endswith(".pdf"):
                continue
            results.append(
                {
                    "public_id": key[:-4],
                    "filename": key,
                    "secure_url": f"{REPORTS_PUBLIC_URL}/{key}",
                }
            )
            if len(results) >= max_results:
                return sorted(results, key=lambda r: r["filename"].lower())
    return sorted(results, key=lambda r: r["filename"].lower())


def find_scan_reports(registration_number: str) -> dict[str, str | None]:
    reg = registration_number.strip()

    def _url_if_exists(key: str) -> str | None:
        try:
            _client.head_object(Bucket=REPORTS_BUCKET, Key=key)
            return f"{REPORTS_PUBLIC_URL}/{key}"
        except ClientError:
            return None

    return {
        "scan_report_1_url": _url_if_exists(f"{reg}.pdf"),
        "scan_report_2_url": _url_if_exists(f"{reg}-Scan2.pdf"),
    }


# --- Blacklist vehicle images ------------------------------------------------


def upload_blacklist_image(content: bytes, content_type: str) -> str:
    ext = (content_type.rsplit("/", 1)[-1] or "jpg").lower()
    if ext == "jpeg":
        ext = "jpg"
    key = f"{uuid.uuid4().hex}.{ext}"
    _put(BLACKLIST_BUCKET, key, content, content_type)
    return f"{BLACKLIST_PUBLIC_URL}/{key}"


def delete_blacklist_image(url: str | None) -> None:
    key = _key_from_url(BLACKLIST_PUBLIC_URL, url)
    if key:
        _delete(BLACKLIST_BUCKET, key)
