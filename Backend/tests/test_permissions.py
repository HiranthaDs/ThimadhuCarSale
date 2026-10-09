"""Owner-customizable employee access: defaults, updates and enforcement."""
import asyncio
import json
import unittest
import uuid

# The reset module installs isolated configuration before application imports.
import test_password_reset as reset_tests
from fastapi import FastAPI, HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from auth.dependencies import require_permission
from auth.model import User, UserRole
from auth.router import router as auth_router
from clients.model import ClientProfileStatus
from clients.schema import ClientProfileCreate
from clients.service import ClientProfileService
from core.database import Base, get_db
from permissions.router import router as permissions_router
from permissions.catalog import DEFAULT_PERMISSIONS, PERMISSION_KEYS
from permissions.service import PermissionService
from reports.model import InspectionReport
from reports.service import ReportService
import main  # noqa: F401  Register all application models.


class PermissionTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine, expire_on_commit=False)
        self.owner = self.add_user(UserRole.owner)
        self.service = PermissionService(self.db)

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def add_user(self, role, name=None):
        user = User(id=uuid.uuid4(), email=f"{uuid.uuid4().hex[:8]}@example.com", full_name=name or role.value.title(),
                    role=role, is_active=True, hashed_password="x")
        self.db.add(user)
        self.db.commit()
        return user

    def allowed(self, user, *keys):
        try:
            require_permission(*keys)(current_user=user, db=self.db)
            return True
        except HTTPException:
            return False

    def test_role_defaults_until_owner_saves(self):
        for role, keys in DEFAULT_PERMISSIONS.items():
            self.assertEqual(self.service.for_user(self.add_user(role)), keys)
        self.assertEqual(self.service.for_user(self.owner), set(PERMISSION_KEYS))
        self.assertEqual(self.service.for_user(self.add_user(UserRole.ceo)), set(PERMISSION_KEYS))

    def test_access_is_per_person_and_adds_required_view(self):
        first = self.add_user(UserRole.accountant, "First")
        second = self.add_user(UserRole.accountant, "Second")
        self.assertFalse(self.allowed(first, "clients.approve"))

        result = self.service.update(first.id, ["clients.approve"], self.owner)
        self.assertEqual(result["permissions"], ["clients.approve", "clients.view"])
        self.assertTrue(result["customized"])
        self.assertTrue(self.allowed(first, "clients.approve"))
        self.assertFalse(self.allowed(first, "blacklist.view"))
        # The other accountant keeps the role defaults.
        self.assertFalse(self.allowed(second, "clients.approve"))
        self.assertTrue(self.allowed(second, "blacklist.view"))

        reset = self.service.reset(first.id, self.owner)
        self.assertFalse(reset["customized"])
        self.assertEqual(set(reset["permissions"]), DEFAULT_PERMISSIONS[UserRole.accountant])

    def test_owner_cannot_be_restricted(self):
        with self.assertRaises(HTTPException):
            self.service.update(self.owner.id, [], self.owner)
        self.assertTrue(self.allowed(self.owner, "accounts.manage"))

    def test_ceo_starts_with_everything_and_owner_can_restrict(self):
        ceo = self.add_user(UserRole.ceo)
        self.assertTrue(self.allowed(ceo, "accounts.manage"))
        self.assertTrue(self.allowed(ceo, "clients.delete"))
        self.service.update(ceo.id, ["clients.view"], self.owner)
        self.assertFalse(self.allowed(ceo, "accounts.manage"))
        self.assertFalse(self.allowed(ceo, "clients.delete"))
        self.assertTrue(self.allowed(ceo, "clients.view"))

    def test_ceo_only_permissions_are_not_given_to_staff(self):
        admin = self.add_user(UserRole.admin)
        result = self.service.update(admin.id, ["accounts.manage", "reports.review", "clients.view"], self.owner)
        self.assertEqual(result["permissions"], ["clients.view"])

    def test_overview_lists_every_employee(self):
        self.add_user(UserRole.technician, "Kasun")
        employees = {e["full_name"]: e for e in self.service.overview()["employees"]}
        self.assertTrue(employees["Owner"]["full_access"])
        self.assertFalse(employees["Kasun"]["full_access"])
        self.assertEqual(set(employees["Kasun"]["permissions"]), DEFAULT_PERMISSIONS[UserRole.technician])


class ApprovalChainTests(unittest.TestCase):
    """Every role with the Approve tick approves a client profile, then the owner."""

    def setUp(self):
        self.engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine, expire_on_commit=False)
        self.owner = self.add_user(UserRole.owner)
        self.ceo = self.add_user(UserRole.ceo)
        self.accountant = self.add_user(UserRole.accountant)
        self.clients = ClientProfileService(self.db)
        self.access = PermissionService(self.db)

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def add_user(self, role):
        user = User(id=uuid.uuid4(), email=f"{role.value}@example.com", full_name=role.value.title(),
                    role=role, is_active=True, hashed_password="x")
        self.db.add(user)
        self.db.commit()
        return user

    def new_profile(self):
        return self.clients.create(ClientProfileCreate(local_client_name="Client"), self.accountant)

    def test_every_ticked_role_approves_before_the_owner(self):
        # Defaults: the CEO can approve, the accountant can't — give it to them.
        self.access.update(self.accountant.id, [*self.access.for_user(self.accountant), "clients.approve"], self.owner)
        profile = self.new_profile()
        self.assertEqual(profile.status, ClientProfileStatus.pending_ceo)
        self.assertEqual(profile.waiting_for, ["ceo", "accountant"])

        with self.assertRaises(HTTPException):
            self.clients.approve(profile.id, self.owner)  # Too early.
        profile = self.clients.approve(profile.id, self.accountant)
        self.assertEqual(profile.waiting_for, ["ceo"])
        # Who approved is recorded with their role and name.
        self.assertEqual([(a["role"], a["name"]) for a in profile.role_approvals], [("accountant", "Accountant")])
        with self.assertRaises(HTTPException):
            self.clients.approve(profile.id, self.accountant)  # Already approved.
        self.assertEqual([p.id for p in self.clients.list_all(awaiting=self.ceo)], [profile.id])
        self.assertEqual(self.clients.list_all(awaiting=self.accountant), [])

        profile = self.clients.approve(profile.id, self.ceo)
        self.assertEqual(profile.status, ClientProfileStatus.pending_owner)
        profile = self.clients.approve(profile.id, self.owner)
        self.assertEqual(profile.status, ClientProfileStatus.approved)

    def test_no_approvers_goes_straight_to_owner(self):
        self.access.update(self.ceo.id, ["clients.view"], self.owner)
        profile = self.new_profile()
        self.assertEqual(profile.status, ClientProfileStatus.pending_owner)

    def test_removing_last_approver_moves_waiting_profiles_on(self):
        profile = self.new_profile()
        self.assertEqual(profile.waiting_for, ["ceo"])
        self.access.update(self.ceo.id, ["clients.view"], self.owner)
        self.assertEqual(self.clients.get(profile.id).status, ClientProfileStatus.pending_owner)


class ReportApprovalTests(unittest.TestCase):
    """Inspection Report 1 and 2 each have their own Approve tick before the owner checks them."""

    def setUp(self):
        self.engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine, expire_on_commit=False)
        self.owner = ApprovalChainTests.add_user(self, UserRole.owner)
        self.ceo = ApprovalChainTests.add_user(self, UserRole.ceo)
        self.access = PermissionService(self.db)
        self.reports = ReportService(self.db, self.owner)

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def add_report(self, registration):
        report = InspectionReport(registration_number=registration, url="r2://reports/a.pdf", status="pending")
        self.db.add(report)
        self.db.commit()
        return report

    def test_ceo_approves_before_owner_checks(self):
        report = self.add_report("CBE-1")
        self.assertEqual(self.reports.annotate(report).waiting_for, ["ceo"])
        with self.assertRaises(ValueError):
            self.reports.set_status(report, "checked")
        self.reports.approve(report, self.ceo, self.access.for_user(self.ceo))
        self.assertEqual(report.waiting_for, [])
        self.assertEqual(report.role_approvals[0]["name"], "Ceo")
        self.assertEqual(self.reports.set_status(report, "checked").status, "checked")

    def test_report_2_uses_its_own_tick(self):
        # The CEO keeps the Report 1 tick but loses the Report 2 one.
        keys = self.access.for_user(self.ceo) - {"reports2.approve"}
        self.access.update(self.ceo.id, list(keys), self.owner)
        copy = self.add_report("CBE-1-Inspection Report 2")
        self.assertEqual(ReportService(self.db).annotate(copy).waiting_for, [])
        with self.assertRaises(PermissionError):
            ReportService(self.db).approve(copy, self.ceo, self.access.for_user(self.ceo))
        self.assertEqual(ReportService(self.db).set_status(copy, "checked").status, "checked")

    def test_sent_back_report_needs_approvals_again(self):
        report = self.add_report("CBE-2")
        self.reports.approve(report, self.ceo, self.access.for_user(self.ceo))
        self.reports.set_status(report, "needs_modifications")
        report.status = "pending"
        self.assertEqual(ReportService(self.db).annotate(report).waiting_for, ["ceo"])


class CustomizeUnlockTests(unittest.TestCase):
    """Customize needs the owner's password again, as a short-lived pass."""

    def setUp(self):
        self.engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine, expire_on_commit=False)
        self.db.add(User(email="owner@example.com", full_name="Owner", role=UserRole.owner, is_active=True,
                         hashed_password=reset_tests.hash_password("Original123!")))
        self.db.commit()
        self.app = FastAPI()
        self.app.include_router(auth_router)
        self.app.include_router(permissions_router)
        self.app.dependency_overrides[get_db] = lambda: self.db

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def request(self, path, body=None, method="POST", cookie=None, unlock=None):
        """Returns (status, json body, headers) from one raw ASGI request."""
        headers = [(b"content-type", b"application/json"), (b"host", b"localhost"),
                   (b"origin", b"http://localhost:5173")]
        if cookie:
            headers.append((b"cookie", cookie.encode()))
        if unlock:
            headers.append((b"x-customize-unlock", unlock.encode()))
        scope = {"type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1", "method": method,
                 "scheme": "https", "path": path, "raw_path": path.encode(), "query_string": b"",
                 "root_path": "", "headers": headers, "client": ("127.0.0.1", 123), "server": ("localhost", 443)}
        pending, messages = [json.dumps(body or {}).encode()], []

        async def receive():
            if pending:
                return {"type": "http.request", "body": pending.pop(), "more_body": False}
            return {"type": "http.disconnect"}

        async def send(message):
            messages.append(message)

        asyncio.run(self.app(scope, receive, send))
        start = next(m for m in messages if m["type"] == "http.response.start")
        raw = b"".join(m.get("body", b"") for m in messages if m["type"] == "http.response.body")
        return start["status"], json.loads(raw) if raw else None, dict(start["headers"])

    def test_password_required_before_customize_opens(self):
        status, _, headers = self.request("/auth/login", {"email": "owner@example.com", "password": "Original123!"})
        self.assertEqual(status, 200)
        cookie = headers[b"set-cookie"].decode().split(";", 1)[0]

        self.assertEqual(self.request("/permissions/", method="GET", cookie=cookie)[0], 403)
        # A wrong password is 403, not 401, which would sign the owner out.
        self.assertEqual(self.request("/permissions/unlock", {"password": "Wrong123!"}, cookie=cookie)[0], 403)

        status, data, _ = self.request("/permissions/unlock", {"password": "Original123!"}, cookie=cookie)
        self.assertEqual(status, 200)
        token = data["unlock_token"]
        self.assertEqual(self.request("/permissions/", method="GET", cookie=cookie, unlock=token)[0], 200)
        # The pass is not a login token.
        self.assertEqual(self.request("/auth/me", method="GET", cookie=f"thimadhu_session={token}")[0], 401)

if __name__ == "__main__":
    unittest.main()
