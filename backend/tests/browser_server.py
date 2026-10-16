"""Disposable fixture server for Playwright, never for real accounts."""

import os
from pathlib import Path
from tempfile import TemporaryDirectory
from uuid import uuid4

from alembic.config import Config
from sqlalchemy import create_engine, event, select, text
from sqlalchemy.orm import Session

from alembic import command
from app.accounts import provision
from app.core.database import Base, get_session
from app.main import app
from app.modules.curriculum.repository import list_courses
from app.modules.personal.models import Student, User
from app.modules.personal.schemas import HistoryPayload
from app.modules.personal.service import import_history
from app.seed import seed

# Real PostgreSQL can be used for browser persistence as well as pytest.
url = os.environ.get("TEST_DATABASE_URL")
temporary = TemporaryDirectory(prefix="pai-browser-")
admin = None
schema = "test_browser_" + uuid4().hex
if url:
    if not url.startswith("postgresql"):
        raise RuntimeError("TEST_DATABASE_URL must use PostgreSQL")
    admin = create_engine(url)
    with admin.begin() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    engine = create_engine(url)

    @event.listens_for(engine, "connect")
    def search_path(dbapi_connection, _):
        dbapi_connection.autocommit = True
        dbapi_connection.execute(f'SET search_path TO "{schema}"')
        dbapi_connection.autocommit = False

    config = Config("alembic.ini")
    with engine.begin() as connection:
        config.attributes["connection"] = connection
        command.upgrade(config, "head")
else:
    engine = create_engine(
        f"sqlite:///{Path(temporary.name) / 'browser.db'}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
with Session(engine) as db:
    seed(db)
    for letter in ["a", "b"]:
        provision(db, f"student-{letter}@example.test", "fictional-secret", "student", letter)
    provision(db, "coord@example.test", "fictional-secret", "coordination")
    student = db.scalar(select(Student).where(Student.registration == "a"))
    author = db.scalar(select(User).where(User.role == "coordination"))
    import_history(
        db,
        student,
        author,
        HistoryPayload(
            schema_version=1,
            source="Playwright fictício",
            source_reference="not-institutional",
            current_period=2,
            records=[{"course_id": "ip", "academic_term": "2026.1", "status": "completed"}],
        ),
        list_courses(db),
    )


def sessions():
    with Session(engine) as db:
        yield db


app.dependency_overrides[get_session] = sessions


# Uvicorn calls this on ordinary termination, cleaning only our disposable schema.
@app.on_event("shutdown")
def cleanup():
    engine.dispose()
    if admin:
        with admin.begin() as connection:
            connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        admin.dispose()
    temporary.cleanup()
