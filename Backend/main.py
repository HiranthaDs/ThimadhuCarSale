from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from activity.router import router as activity_router
from auth.router import router as auth_router
from auth.service import AuthService
from blacklist.router import router as blacklist_router
from clients.router import router as clients_router
from core.config import get_settings
from core.database import Base, SessionLocal, engine

# Import models so they are registered on Base before create_all runs.
from auth import model  # noqa: F401
from activity import model as activity_model  # noqa: F401
from blacklist import model as blacklist_model  # noqa: F401
from clients import model as client_model  # noqa: F401

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        AuthService(db).bootstrap_owner(
            email=settings.owner_bootstrap_email,
            password=settings.owner_bootstrap_password,
            full_name=settings.owner_bootstrap_name,
        )
    finally:
        db.close()

    yield


app = FastAPI(title="Thimadhu API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(clients_router)
app.include_router(blacklist_router)
app.include_router(activity_router)


@app.get("/health")
def health():
    return {"status": "ok"}
