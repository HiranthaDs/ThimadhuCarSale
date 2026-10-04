import base64
import binascii
import io
import re
import warnings

from fastapi import HTTPException
from PIL import Image, ImageOps, UnidentifiedImageError
from pypdf import PdfReader
from pypdf.generic import IndirectObject

from core.config import get_settings

_DATA_URL_RE = re.compile(r"^data:([\w.+-]+/[\w.+-]+);base64,(.+)$", re.DOTALL)
Image.MAX_IMAGE_PIXELS = 20_000_000
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "application/pdf"}
PDF_FORBIDDEN = {"/JavaScript", "/JS", "/Launch", "/AA", "/EmbeddedFiles",
                 "/EmbeddedFile", "/RichMedia", "/XFA", "/SubmitForm", "/ImportData", "/GoToR"}


def validate_file(content: bytes, content_type: str) -> bytes:
    if not content or len(content) > get_settings().max_file_bytes:
        raise HTTPException(413, "File is empty or exceeds the 10 MB limit.")
    if content_type not in ALLOWED_TYPES:
        raise HTTPException(400, "Only JPEG, PNG, WebP images and PDF documents are supported.")
    if content_type == "application/pdf":
        if not content.startswith(b"%PDF-"):
            raise HTTPException(400, "The uploaded file is not a PDF.")
        try:
            reader = PdfReader(io.BytesIO(content), strict=True)
            if reader.is_encrypted or len(reader.pages) > 200:
                raise ValueError("Encrypted or oversized PDF")
            stack, visited = [reader.trailer], set()
            while stack:
                value = stack.pop()
                if isinstance(value, IndirectObject):
                    key = (value.idnum, value.generation)
                    if key in visited:
                        continue
                    visited.add(key)
                    if len(visited) > 20000:
                        raise ValueError("PDF is too complex")
                    value = value.get_object()
                if isinstance(value, dict):
                    if "/OpenAction" in value:
                        action = value["/OpenAction"]
                        if isinstance(action, IndirectObject):
                            action = action.get_object()
                        # A local page destination is how jsPDF sets its initial view.
                        if not isinstance(action, (list, tuple)) and not (isinstance(action, dict) and action.get("/S") == "/GoTo"):
                            raise ValueError("Active PDF open action")
                    if PDF_FORBIDDEN.intersection(str(k) for k in value):
                        raise ValueError("Active PDF content")
                    if str(value.get("/S", "")) in PDF_FORBIDDEN:
                        raise ValueError("Active PDF action")
                    stack.extend(value.values())
                elif isinstance(value, (list, tuple)):
                    stack.extend(value)
            return content
        except Exception:
            raise HTTPException(400, "Invalid PDF or unsupported active/embedded content.") from None
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(content)) as image:
                expected = {"image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WEBP"}[content_type]
                if image.format != expected:
                    raise ValueError("Mismatched image type")
                image.load()
                output = io.BytesIO()
                image = ImageOps.exif_transpose(image)
                image.info.clear()
                image.save(output, format=expected)
                if output.tell() > get_settings().max_file_bytes:
                    raise HTTPException(413, "Processed image exceeds the file limit.")
                return output.getvalue()
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise HTTPException(400, "Invalid image or image dimensions are too large.") from None


def decode_data_url(value: str) -> tuple[str, bytes] | None:
    if not isinstance(value, str) or not value.startswith("data:"):
        return None
    match = _DATA_URL_RE.fullmatch(value)
    if not match:
        raise HTTPException(400, "Invalid file encoding.")
    content_type, encoded = match.groups()
    if len(encoded) > (get_settings().max_file_bytes * 4 // 3 + 8):
        raise HTTPException(413, "File exceeds the size limit.")
    try:
        content = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error):
        raise HTTPException(400, "Invalid file encoding.") from None
    return content_type, validate_file(content, content_type)
