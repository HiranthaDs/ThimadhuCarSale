"""Run schema changes once, before starting API workers."""
from pathlib import Path
from dotenv import load_dotenv

# Administrative credentials are separate from the API runtime environment.
load_dotenv(Path(__file__).resolve().with_name(".env.migration"), override=True)
from main import migrate_schema

if __name__ == "__main__":
    migrate_schema()
    print("Database migration completed.")
