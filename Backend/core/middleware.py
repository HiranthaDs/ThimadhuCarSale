from fastapi import HTTPException
from starlette.responses import JSONResponse


class BodySizeLimitMiddleware:
    """Enforce the cap on actual bytes, including chunked requests."""
    def __init__(self, app, max_bytes):
        self.app, self.max_bytes = app, max_bytes

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        headers = dict(scope.get("headers", []))
        declared = headers.get(b"content-length")
        if declared:
            try:
                size = int(declared)
                if size < 0:
                    raise ValueError()
            except ValueError:
                return await JSONResponse({"detail": "Invalid Content-Length."}, 400)(scope, receive, send)
            if size > self.max_bytes:
                return await JSONResponse({"detail": "Request body is too large."}, 413)(scope, receive, send)
        consumed = 0
        async def bounded_receive():
            nonlocal consumed
            message = await receive()
            if message["type"] == "http.request":
                consumed += len(message.get("body", b""))
                if consumed > self.max_bytes:
                    raise HTTPException(413, "Request body is too large.")
            return message
        await self.app(scope, bounded_receive, send)
