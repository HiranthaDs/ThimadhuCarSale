import base64
import re

_DATA_URL_RE = re.compile(r"^data:([\w.+-]+/[\w.+-]+);base64,(.+)$", re.DOTALL)


def decode_data_url(value: str) -> tuple[str, bytes] | None:
    """("data:image/jpeg;base64,...") -> ("image/jpeg", b"..."), or None if not a data URL."""
    match = _DATA_URL_RE.match(value)
    if not match:
        return None
    content_type, b64_data = match.groups()
    return content_type, base64.b64decode(b64_data)
