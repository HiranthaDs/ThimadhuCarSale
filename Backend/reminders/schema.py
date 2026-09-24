import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, field_validator

MAX_REMARK_WORDS = 50


def _check_remark(value: str) -> str:
    value = (value or "").strip()
    if not value:
        raise ValueError("Remark is required.")
    word_count = len(value.split())
    if word_count > MAX_REMARK_WORDS:
        raise ValueError(f"Remark must be at most {MAX_REMARK_WORDS} words (currently {word_count}).")
    return value


class ReminderCreate(BaseModel):
    remind_date: date
    title: str
    remark: str

    @field_validator("title")
    @classmethod
    def title_not_blank(cls, value: str) -> str:
        value = (value or "").strip()
        if not value:
            raise ValueError("Title is required.")
        return value

    @field_validator("remark")
    @classmethod
    def remark_max_words(cls, value: str) -> str:
        return _check_remark(value)


class ReminderUpdate(ReminderCreate):
    pass


class ReminderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    remind_date: date
    title: str
    remark: str
    acknowledged: bool
