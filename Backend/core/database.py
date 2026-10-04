from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from core.config import get_settings

settings = get_settings()

engine_options = {"pool_pre_ping": True}
certificate = settings.database_sslrootcert
if certificate != "system" and not Path(certificate).is_absolute():
    certificate = str(Path(__file__).resolve().parents[1] / certificate)
if settings.database_url.startswith("postgresql"):
    engine_options.update(
        pool_size=settings.database_pool_size,
        max_overflow=settings.database_max_overflow,
        pool_timeout=10,
        pool_recycle=300,
        connect_args={"sslmode": settings.database_sslmode,
                      "sslrootcert": certificate,
                      "connect_timeout": 10},
    )
engine = create_engine(settings.database_url, **engine_options)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
