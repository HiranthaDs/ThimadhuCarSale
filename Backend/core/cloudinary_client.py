import cloudinary
import cloudinary.api
import cloudinary.uploader
from cloudinary.exceptions import NotFound

from core.config import get_settings

_settings = get_settings()

cloudinary.config(
    cloud_name=_settings.cloudinary_cloud_name,
    api_key=_settings.cloudinary_api_key,
    api_secret=_settings.cloudinary_api_secret,
    secure=True,
)

SCAN_REPORT_FOLDER = "scan_reports"
INSPECTION_REPORT_FOLDER = "inspection_reports"


def upload_pdf(content: bytes, public_id: str) -> str:
    """Upload a PDF's bytes to Cloudinary and return its secure_url.

    `resource_type="raw"` is required for non-image files like PDFs.
    """
    result = cloudinary.uploader.upload(
        content,
        public_id=f"{INSPECTION_REPORT_FOLDER}/{public_id}",
        resource_type="raw",
        overwrite=True,
        format="pdf",
    )
    return result["secure_url"]


def delete_pdf(public_id: str) -> None:
    cloudinary.uploader.destroy(f"{INSPECTION_REPORT_FOLDER}/{public_id}", resource_type="raw")


def _find_secure_url(public_id: str) -> str | None:
    for resource_type in ("image", "raw", "video"):
        try:
            resource = cloudinary.api.resource(public_id, resource_type=resource_type)
            return resource.get("secure_url")
        except NotFound:
            continue
    return None


def find_scan_reports(registration_number: str) -> dict[str, str | None]:
    reg = registration_number.strip()
    return {
        "scan_report_1_url": _find_secure_url(f"{SCAN_REPORT_FOLDER}/{reg}_scan1"),
        "scan_report_2_url": _find_secure_url(f"{SCAN_REPORT_FOLDER}/{reg}_scan2"),
    }


def list_pdf_reports(max_results: int = 200) -> list[dict]:
    seen: dict[str, dict] = {}
    for resource_type in ("image", "raw"):
        try:
            result = cloudinary.api.resources(resource_type=resource_type, type="upload", max_results=max_results)
        except Exception:
            continue
        for resource in result.get("resources", []):
            public_id = resource.get("public_id") or ""
            fmt = (resource.get("format") or "").lower()
            if fmt != "pdf" and not public_id.lower().endswith(".pdf"):
                continue
            filename = public_id.rsplit("/", 1)[-1]
            seen[public_id] = {
                "public_id": public_id,
                "filename": filename,
                "secure_url": resource.get("secure_url"),
                "format": fmt or "pdf",
                "resource_type": resource_type,
            }
    return sorted(seen.values(), key=lambda r: r["filename"].lower())
