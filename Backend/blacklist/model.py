import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class VehicleBlacklist(Base):
    __tablename__ = "vehicle_blacklist"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    vehicle_number: Mapped[str | None] = mapped_column(String(60), nullable=True)
    chassis_number: Mapped[str | None] = mapped_column(String(120), nullable=True)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)

    images: Mapped[list["VehicleBlacklistImage"]] = relationship(
        back_populates="entry", cascade="all, delete-orphan", order_by="VehicleBlacklistImage.created_at"
    )


class VehicleBlacklistImage(Base):
    __tablename__ = "vehicle_blacklist_images"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    blacklist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("vehicle_blacklist.id", ondelete="CASCADE"), nullable=False
    )
    image: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    entry: Mapped["VehicleBlacklist"] = relationship(back_populates="images")
