from sqlalchemy import text
from core.database import Base


def grant_runtime_permissions(conn):
    """Keep the API role scoped to application data; migrations retain DDL rights."""
    if not conn.execute(text("SELECT 1 FROM pg_roles WHERE rolname='thimadhu_api'")).first():
        return
    conn.execute(text("GRANT USAGE ON SCHEMA public TO thimadhu_api"))
    for table in Base.metadata.sorted_tables:
        name = table.name
        privileges = "SELECT, INSERT" if name == "activity_logs" else "SELECT, INSERT, UPDATE, DELETE"
        conn.execute(text(f'GRANT {privileges} ON TABLE "{name}" TO thimadhu_api'))
        conn.execute(text(f'DROP POLICY IF EXISTS api_runtime_access ON "{name}"'))
        conn.execute(text(f'CREATE POLICY api_runtime_access ON "{name}" TO thimadhu_api USING (true) WITH CHECK (true)'))
