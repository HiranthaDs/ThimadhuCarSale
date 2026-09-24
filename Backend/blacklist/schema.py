import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from core.security import is_safe_media_url


def _check_images(images: list[str]) -> list[str]:
    for image in images:
        if not is_safe_media_url(image):
            raise ValueError("Images must be an uploaded photo or an https link.")
    return images


class VehicleBlacklistCreate(BaseModel):
    vehicle_number: str | None = None
    chassis_number: str | None = None
    remarks: str | None = None
    images: list[str] = Field(default_factory=list)

    @field_validator("images")
    @classmethod
    def images_are_safe(cls, value: list[str]) -> list[str]:
        return _check_images(value)


class VehicleBlacklistUpdate(BaseModel):
    vehicle_number: str | None = None
    chassis_number: str | None = None
    remarks: str | None = None
    # The full list of images to keep; existing ones are sent back as-is.
    images: list[str] = Field(default_factory=list)

    @field_validator("images")
    @classmethod
    def images_are_safe(cls, value: list[str]) -> list[str]:
        return _check_images(value)


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
