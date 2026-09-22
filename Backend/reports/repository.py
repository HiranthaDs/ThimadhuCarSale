import uuid

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from reports.model import InspectionReport

SEARCHABLE_COLUMNS = [
    "registration_number",
    "vehicle_title",
    "buyer_name",
    "technician_name",
]


class ReportRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, *, created_by: uuid.UUID | None, **fields) -> InspectionReport:
        report = InspectionReport(created_by=created_by, **fields)
        self.db.add(report)
        self.db.commit()
        self.db.refresh(report)
        return report

    def list_all(self, q: str | None = None, status: str | None = None) -> list[InspectionReport]:
        stmt = select(InspectionReport)
        if q:
            pattern = f"%{q.strip()}%"
            conditions = [getattr(InspectionReport, col).ilike(pattern) for col in SEARCHABLE_COLUMNS]
            stmt = stmt.where(or_(*conditions))
        if status:
            stmt = stmt.where(InspectionReport.status == status)
        stmt = stmt.order_by(InspectionReport.created_at.desc())
        return list(self.db.scalars(stmt))

    def get(self, report_id: uuid.UUID) -> InspectionReport | None:
        return self.db.get(InspectionReport, report_id)

    def update(self, report: InspectionReport, **fields) -> InspectionReport:
        for key, value in fields.items():
            if value is not None:
                setattr(report, key, value)
        self.db.commit()
        self.db.refresh(report)
        return report

    def set_status(self, report: InspectionReport, status: str) -> InspectionReport:
        report.status = status
        self.db.commit()
        self.db.refresh(report)
        return report

    def delete(self, report: InspectionReport) -> None:
        self.db.delete(report)
        self.db.commit()
