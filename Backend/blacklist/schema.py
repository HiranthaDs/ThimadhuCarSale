import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class VehicleBlacklistCreate(BaseModel):
    vehicle_number: str | None = None
    chassis_number: str | None = None
    remarks: str | None = None
    images: list[str] = Field(default_factory=list)


class VehicleBlacklistImageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    image: str


class VehicleBlacklistOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    vehicle_number: str | None
    chassis_number: str | None
    remarks: str | None
    images: list[VehicleBlacklistImageOut]
