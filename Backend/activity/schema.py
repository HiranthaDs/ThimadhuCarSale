import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ActivityLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    actor_id: uuid.UUID | None
    actor_name: str
    actor_role: str
    action: str
    entity_type: str
    entity_id: uuid.UUID | None
    description: str
    created_at: datetime
