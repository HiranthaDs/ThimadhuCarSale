"""Regression tests with an isolated database and mocked object storage."""
import asyncio
import base64
import io
import os
import unittest
import uuid
from types import SimpleNamespace
from unittest.mock import patch

# The reset module installs isolated configuration before application imports.
import test_password_reset as reset_tests
os.environ["R2_ACCOUNT_ID"] = "test-account"
os.environ["R2_ACCESS_KEY_ID"] = "test-key"
os.environ["R2_SECRET_ACCESS_KEY"] = "test-secret"
os.environ["R2_REPORTS_BUCKET"] = "reports"
os.environ["R2_BLACKLIST_BUCKET"] = "blacklist"
from fastapi import FastAPI, HTTPException, Request
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from PIL import Image
from pypdf import PdfWriter
from auth.model import User, UserRole, AuthSession
from auth.service import AuthService
from auth.schema import LoginRequest
from auth.router import router as auth_router
from core.database import Base, get_db
from core.middleware import BodySizeLimitMiddleware
from core.media import decode_data_url, validate_file
from core.rate_limit import consume
from core.r2_client import (upload_report_pdf, existing_reference, private_url,
                           canonical_url, delete_form_attachment, delete_report_pdf)
from reports.model import InspectionReport
from reports.service import ReportService, _offload_form_data
from reports.router import router as reports_router
from reports.repository import ReportRepository
from clients.model import ClientProfile, ClientProfileStatus
from clients.schema import ClientProfileUpdate
from clients.service import ClientProfileService
from activity.model import ActivityLog
import main  # Register all application models, without running migrations.

async def request(app, path, body=None, method="POST", cookie=None, origin="http://localhost:5173", chunks=None):
    headers=[(b"content-type",b"application/json"),(b"host",b"localhost")]
    if cookie: headers.append((b"cookie",cookie.encode()))
    if origin: headers.append((b"origin",origin.encode()))
    scope={"type":"http","asgi":{"version":"3.0"},"http_version":"1.1","method":method,
           "scheme":"https","path":path,"raw_path":path.encode(),"query_string":b"",
           "root_path":"","headers":headers,"client":("127.0.0.1",123),"server":("localhost",443)}
    import json
    pending=list(chunks or [json.dumps(body or {}).encode()]); messages=[]
    async def receive():
        if pending:
            chunk=pending.pop(0)
            return {"type":"http.request","body":chunk,"more_body":bool(pending)}
        return {"type":"http.disconnect"}
    async def send(message): messages.append(message)
    await app(scope,receive,send)
    start=next(m for m in messages if m["type"]=="http.response.start")
    raw=b"".join(m.get("body",b"") for m in messages if m["type"]=="http.response.body")
    return start["status"], json.loads(raw) if raw else None, dict(start["headers"])

def pdf(active=False):
    writer=PdfWriter(); writer.add_blank_page(width=100,height=100)
    if active: writer.add_js("app.alert('test')")
    output=io.BytesIO(); writer.write(output); return output.getvalue()

class SecurityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls): cls.password_hash=reset_tests.hash_password("Original123!")
    def setUp(self):
        self.engine=create_engine("sqlite+pysqlite:///:memory:",connect_args={"check_same_thread":False},poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.db=Session(self.engine,expire_on_commit=False)
        self.user=User(email="owner@example.com",full_name="Owner",role=UserRole.owner,is_active=True,hashed_password=self.password_hash)
        self.db.add(self.user);self.db.commit()
        self.app=FastAPI();self.app.include_router(auth_router);self.app.include_router(reports_router)
        self.app.dependency_overrides[get_db]=lambda:self.db
    def tearDown(self): self.db.close();self.engine.dispose()
    def request(self,*args,**kwargs): return asyncio.run(request(self.app,*args,**kwargs))
    def login(self):
        status,data,headers=self.request("/auth/login",{"email":self.user.email,"password":"Original123!"})
        self.assertEqual(status,200);self.assertNotIn("access_token",data)
        raw=headers[b"set-cookie"].decode();self.assertIn("HttpOnly",raw)
        return raw.split(";",1)[0]
    def test_cookie_login_csrf_and_logout(self):
        status,_,_=self.request("/auth/login",{"email":self.user.email,"password":"Original123!"},origin="https://evil.example")
        self.assertEqual(status,403)
        cookie=self.login()
        self.assertEqual(self.request("/auth/me",method="GET",cookie=cookie)[0],200)
        self.assertEqual(self.request("/auth/logout",cookie=cookie,origin=None)[0],403)
        self.assertEqual(self.request("/auth/logout",cookie=cookie)[0],204)
        self.assertEqual(self.request("/auth/me",method="GET",cookie=cookie)[0],401)
    def test_shared_rate_limit(self):
        consume(self.db,"test","caller",1,60)
        with Session(self.engine) as second:
            with self.assertRaises(HTTPException) as caught: consume(second,"test","caller",1,60)
        self.assertEqual(caught.exception.status_code,429)
    def test_pdf_names_cannot_overwrite_another_upload(self):
        with patch("core.r2_client._put") as put:
            first=upload_report_pdf(pdf(),"ABC");second=upload_report_pdf(pdf(),"ABC")
        self.assertNotEqual(first,second);self.assertNotEqual(put.call_args_list[0].args[1],put.call_args_list[1].args[1])
    def test_foreign_attachment_reference_rejected(self):
        for value in ("r2://reports/client-documents/other.pdf","https://evil.example/test.png","data:image/svg+xml;base64,AAAA"):
            with self.subTest(value=value),self.assertRaises(HTTPException): _offload_form_data({"photo":value},["r2://reports/mine.png"])
        self.assertEqual(existing_reference("r2://reports/mine.png",["r2://reports/mine.png"]),"r2://reports/mine.png")
    def test_copy_attachment_deletion_does_not_delete_shared_object(self):
        with patch("core.r2_client._client") as storage:
            delete_form_attachment("r2://reports/shared.png");delete_report_pdf("r2://reports/shared.pdf")
        storage.delete_object.assert_not_called()
    def test_validated_images_and_pdfs(self):
        buffer=io.BytesIO();Image.new("RGB",(2,2)).save(buffer,format="PNG")
        value="data:image/png;base64,"+base64.b64encode(buffer.getvalue()).decode()
        self.assertEqual(decode_data_url(value)[0],"image/png")
        self.assertEqual(validate_file(pdf(),"application/pdf"),pdf())
        for content,mime in [(b"<html>not png</html>","image/png"),(pdf(True),"application/pdf"),(b"%PDF-not-valid","application/pdf")]:
            with self.subTest(mime=mime),self.assertRaises(HTTPException): validate_file(content,mime)
    def test_browser_generated_pdf_is_accepted(self):
        from pathlib import Path
        content = Path(__file__).with_name("browser-report.pdf").read_bytes()
        self.assertEqual(validate_file(content, "application/pdf"), content)

    def test_report_permissions_and_audit(self):
        service=ReportService(self.db,self.user)
        with patch("reports.service.upload_report_pdf",return_value="r2://reports/a.pdf"):
            report=service.upload_pdf(pdf(),created_by=self.user.id,registration_number="ABC")
        intruder=SimpleNamespace(role=UserRole.technician,id=uuid.uuid4())
        with self.assertRaises(HTTPException): service.require_editor(report,intruder)
        self.assertEqual(self.db.scalar(select(ActivityLog)).action,"report.create")
        cookie=self.login()
        status,body,_=self.request(f"/reports/{report.id}",method="GET",cookie=cookie)
        self.assertEqual(status,200);self.assertTrue(body["editable"])
        self.assertTrue(body["url"].startswith("https://"));self.assertIn("X-Amz-Signature",body["url"])
    def test_private_url_roundtrip(self):
        stored="r2://reports/a.pdf"
        # The application config is isolated; signing requires no network.
        signed=private_url(stored)
        self.assertEqual(canonical_url(signed),stored)
    def test_approved_content_requires_new_reviews(self):
        # A CEO (Approve ticked by default) has to review the edited content again.
        self.db.add(User(email="ceo@example.com",full_name="CEO",role=UserRole.ceo,is_active=True,hashed_password=self.password_hash))
        profile=ClientProfile(created_by=self.user.id,status=ClientProfileStatus.pending_owner)
        self.db.add(profile);self.db.commit()
        updated=ClientProfileService(self.db).update(profile.id,ClientProfileUpdate(local_client_name="Changed"),self.user)
        self.assertEqual(updated.status,ClientProfileStatus.pending_ceo)
    def test_copies_only_lists_newest_copy_first(self):
        from datetime import datetime, timedelta, timezone
        now=datetime.now(timezone.utc)
        for i,name in enumerate(["AAA-1","BBB-2","BBB-2-Inspection Report 2","AAA-1-Inspection Report 2","CCC-3"]):
            self.db.add(InspectionReport(registration_number=name,url="r2://reports/a.pdf",created_at=now+timedelta(minutes=i)))
        self.db.commit();repository=ReportRepository(self.db)
        pairs=repository.list_with_copies(copies_only=True)
        self.assertEqual([(o.registration_number,c.registration_number) for o,c in pairs],
                         [("AAA-1","AAA-1-Inspection Report 2"),("BBB-2","BBB-2-Inspection Report 2")])
        self.assertEqual(len(repository.list_with_copies()),3)
    def test_list_pagination(self):
        for i in range(3): self.db.add(InspectionReport(registration_number=str(i),url="r2://reports/a.pdf"))
        self.db.commit();repository=ReportRepository(self.db)
        first=repository.list_all(limit=2,offset=0);second=repository.list_all(limit=2,offset=2)
        self.assertEqual(len(first),2);self.assertEqual(len(second),1)
        self.assertFalse({r.id for r in first}&{r.id for r in second})
    def test_other_author_cannot_replace_pdf(self):
        service=ReportService(self.db,self.user)
        report=InspectionReport(created_by=uuid.uuid4(),status="pending",url="r2://reports/original.pdf")
        stranger=SimpleNamespace(role=UserRole.technician,id=uuid.uuid4())
        with patch("reports.service.upload_report_pdf") as upload:
            with self.assertRaises(HTTPException): service.replace_pdf(report,pdf(),current_user=stranger)
            upload.assert_not_called()

    def test_checked_report_cannot_be_replaced(self):
        report=InspectionReport(created_by=self.user.id,status="checked",url="r2://reports/original.pdf")
        with patch("reports.service.upload_report_pdf") as upload:
            with self.assertRaises(PermissionError): ReportService(self.db).replace_pdf(report,pdf(),current_user=self.user)
            upload.assert_not_called()

    def test_approved_client_cannot_be_edited_by_staff(self):
        profile=ClientProfile(created_by=self.user.id,status=ClientProfileStatus.approved)
        self.db.add(profile);self.db.commit()
        staff=SimpleNamespace(role=UserRole.accountant,id=uuid.uuid4())
        with self.assertRaises(HTTPException):
            ClientProfileService(self.db).update(profile.id,ClientProfileUpdate(local_client_name="Changed"),staff)

    def test_client_cannot_attach_someone_elses_document(self):
        with self.assertRaises(HTTPException):
            ClientProfileService(self.db).prepare_documents({"local_client_nic_image":"r2://reports/client-documents/other.png"})

    def test_client_pagination_filters_status_before_limit(self):
        from clients.repository import ClientProfileRepository
        self.db.add_all([ClientProfile(status=ClientProfileStatus.approved),ClientProfile(status=ClientProfileStatus.pending_owner)])
        self.db.commit()
        page=ClientProfileRepository(self.db).list_all(limit=1,status_filter=ClientProfileStatus.pending_owner)
        self.assertEqual(len(page),1)
        self.assertEqual(page[0].status,ClientProfileStatus.pending_owner)

    def test_copy_uses_new_name_and_preserves_original(self):
        service=ReportService(self.db,self.user)
        original=InspectionReport(created_by=self.user.id,registration_number="ABC-123",status="checked",url="r2://reports/original.pdf",form_data={"photo":"r2://reports/shared.png"})
        self.db.add(original);self.db.commit()
        with patch.object(service,"get_pdf_bytes",return_value=pdf()),patch("reports.service.upload_report_pdf",return_value="r2://reports/copy.pdf"):
            copy=service.create_scan2(original,created_by=self.user.id)
        self.assertEqual(copy.registration_number,"ABC-123-Inspection Report 2")
        self.assertEqual(original.url,"r2://reports/original.pdf")
        self.assertEqual(copy.form_data["photo"],original.form_data["photo"])

    def test_copy_pair_is_complete_even_across_page_boundary(self):
        original=InspectionReport(registration_number="ABC-123",url="r2://reports/one.pdf",status="checked")
        copy=InspectionReport(registration_number="ABC-123-Inspection Report 2",url="r2://reports/two.pdf")
        self.db.add_all([original,copy]);self.db.commit()
        pairs=ReportRepository(self.db).list_with_copies("ABC",limit=1)
        self.assertEqual(len(pairs),1)
        self.assertEqual(pairs[0][0].id,original.id)
        self.assertEqual(pairs[0][1].id,copy.id)
        cookie=self.login()
        status,body,_=self.request("/reports/copies",method="GET",cookie=cookie)
        self.assertEqual(status,200)
        self.assertEqual(body[0]["copy"]["id"],str(copy.id))

    def test_chunked_request_body_is_bounded(self):
        app=FastAPI();app.add_middleware(BodySizeLimitMiddleware,max_bytes=10)
        @app.post("/body")
        async def body(req:Request): return {"length":len(await req.body())}
        status,_,_=asyncio.run(request(app,"/body",chunks=[b"123456",b"789012"]))
        self.assertEqual(status,413)
    def test_legacy_static_uploads_are_not_mounted(self):
        self.assertFalse(any(getattr(route,"path",None)=="/uploads" for route in main.app.routes))

if __name__=="__main__": unittest.main()
