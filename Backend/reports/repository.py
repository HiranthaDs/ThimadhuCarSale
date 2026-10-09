import uuid

from core.approvals import approval_entry
from sqlalchemy import func, or_, select
from activity.model import ActivityLog
from sqlalchemy.orm import Session, defer

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
        self.actor = None

    def audit(self, action, report):
        actor = self.actor
        if actor:
            self.db.add(ActivityLog(
                actor_id=actor.id, actor_name=actor.full_name, actor_role=actor.role.value,
                action=action, entity_type="inspection_report", entity_id=report.id,
                description=f"{action}: {report.registration_number or report.id}",
            ))

    def create(self, *, created_by: uuid.UUID | None, **fields) -> InspectionReport:
        report = InspectionReport(created_by=created_by, **fields)
        self.db.add(report)
        self.db.flush()
        self.audit("report.create", report)
        self.db.commit()
        self.db.refresh(report)
        return report

    def list_all(self, q: str | None = None, status: str | None = None, limit: int = 100, offset: int = 0) -> list[InspectionReport]:
        stmt = select(InspectionReport).options(defer(InspectionReport.form_data))
        if q:
            pattern = f"%{q.strip()}%"
            conditions = [getattr(InspectionReport, col).ilike(pattern) for col in SEARCHABLE_COLUMNS]
            stmt = stmt.where(or_(*conditions))
        if status:
            stmt = stmt.where(InspectionReport.status == status)
        stmt = stmt.order_by(InspectionReport.created_at.desc(), InspectionReport.id.desc())
        return list(self.db.scalars(stmt.limit(limit).offset(offset)))

    def list_with_copies(self, q=None, limit=50, offset=0, copies_only=False):
        """(original, Inspection Report 2 copy or None) pairs, newest original first.
        copies_only: only pairs that have a copy, newest copy first."""
        suffixes = ("-Inspection Report 2", "-Scan2")
        if copies_only:
            return self._list_copies(q, limit, offset, suffixes)
        stmt = select(InspectionReport).options(defer(InspectionReport.form_data)).where(
            InspectionReport.registration_number.is_not(None),
            ~func.lower(InspectionReport.registration_number).endswith("-scan2"),
            ~func.lower(InspectionReport.registration_number).endswith("-inspection report 2"),
        )
        if q:
            stmt = stmt.where(or_(*(getattr(InspectionReport, col).ilike(f"%{q.strip()}%") for col in SEARCHABLE_COLUMNS)))
        originals = list(self.db.scalars(stmt.order_by(InspectionReport.created_at.desc(), InspectionReport.id.desc()).limit(limit).offset(offset)))
        names = [r.registration_number.lower() + suffix.lower() for r in originals for suffix in suffixes]
        copies = self.db.scalars(select(InspectionReport).options(defer(InspectionReport.form_data)).where(
            func.lower(InspectionReport.registration_number).in_(names))) if names else []
        by_name = {r.registration_number.lower(): r for r in copies}
        return [(r, by_name.get(r.registration_number.lower() + suffixes[0].lower()) or by_name.get(r.registration_number.lower() + suffixes[1].lower())) for r in originals]

    def _list_copies(self, q, limit, offset, suffixes):
        name = func.lower(InspectionReport.registration_number)
        stmt = select(InspectionReport).options(defer(InspectionReport.form_data)).where(
            or_(*(name.endswith(suffix.lower()) for suffix in suffixes)))
        if q:
            stmt = stmt.where(or_(*(getattr(InspectionReport, col).ilike(f"%{q.strip()}%") for col in SEARCHABLE_COLUMNS)))
        copies = list(self.db.scalars(stmt.order_by(InspectionReport.created_at.desc(), InspectionReport.id.desc())
                                      .limit(limit).offset(offset)))

        def base(copy):
            reg = copy.registration_number
            for suffix in suffixes:
                if reg.lower().endswith(suffix.lower()):
                    return reg[:-len(suffix)].lower()
            return reg.lower()

        bases = {base(c) for c in copies}
        originals = self.db.scalars(select(InspectionReport).options(defer(InspectionReport.form_data)).where(
            name.in_(bases))) if bases else []
        by_name = {r.registration_number.lower(): r for r in originals}
        # A copy whose original was deleted has nothing to pair with.
        return [(by_name[base(c)], c) for c in copies if base(c) in by_name]

    def find_by_registration(self, registration_number: str) -> InspectionReport | None:
        stmt = select(InspectionReport).where(
            func.lower(InspectionReport.registration_number) == registration_number.lower()
        )
        return self.db.scalars(stmt).first()

    def get(self, report_id: uuid.UUID, lock=False) -> InspectionReport | None:
        stmt = select(InspectionReport).where(InspectionReport.id == report_id)
        if lock:
            stmt = stmt.with_for_update().execution_options(populate_existing=True)
        return self.db.scalar(stmt)

    def update(self, report: InspectionReport, **fields) -> InspectionReport:
        for key, value in fields.items():
            if value is not None:
                setattr(report, key, value)
        self.audit("report.update", report)
        self.db.commit()
        self.db.refresh(report)
        return report

    def set_status(self, report: InspectionReport, status: str, *, clear_approvals=False) -> InspectionReport:
        report.status = status
        if clear_approvals:
            report.role_approvals = []
        self.audit("report.status." + status, report)
        self.db.commit()
        self.db.refresh(report)
        return report

    def add_role_approval(self, report: InspectionReport, user) -> InspectionReport:
        report.role_approvals = [*(report.role_approvals or []), approval_entry(user)]
        self.audit(f"report.{user.role.value}_approve", report)
        self.db.commit()
        self.db.refresh(report)
        return report

    def delete(self, report: InspectionReport) -> None:
        self.audit("report.delete", report)
        self.db.delete(report)
        self.db.commit()
