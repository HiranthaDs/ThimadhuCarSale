from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from activity.schema import ActivityLogOut
from activity.service import ActivityLogService
from auth.dependencies import require_owner
from auth.model import User
from core.database import get_db

router = APIRouter(prefix="/activity", tags=["activity"])


@router.get("/", response_model=list[ActivityLogOut])
def list_activity_logs(
    limit: int = Query(default=200, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    return ActivityLogService(db).list_all(limit)
