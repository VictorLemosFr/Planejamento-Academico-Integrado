import os
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_session
from app.main import app
from app.modules.curriculum.models import Course, Prerequisite


@pytest.fixture
def client(monkeypatch):
    from app.core.config import get_settings

    monkeypatch.setattr(get_settings(), "demo_enabled", True)
    monkeypatch.setattr(get_settings(), "allowed_origins", ["http://testserver"])
    url = os.environ.get("TEST_DATABASE_URL")
    schema = "test_pai_" + uuid4().hex
    if url:
        if not url.startswith("postgresql"):
            raise ValueError("TEST_DATABASE_URL must use PostgreSQL.")
        admin = create_engine(url)
        with admin.begin() as connection:
            connection.execute(text(f'CREATE SCHEMA "{schema}"'))
        engine = create_engine(url)

        @event.listens_for(engine, "connect")
        def search_path(dbapi_connection, _):
            dbapi_connection.autocommit = True
            dbapi_connection.execute(f'SET search_path TO "{schema}"')
            dbapi_connection.autocommit = False

        from alembic.config import Config

        from alembic import command

        with engine.begin() as connection:
            root = Path(__file__).parents[1]
            config = Config(str(root / "alembic.ini"))
            config.set_main_option("script_location", str(root / "alembic"))
            config.attributes["connection"] = connection
            command.upgrade(config, "head")
    else:
        engine = create_engine(
            "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
        )
    if not url:
        Base.metadata.create_all(engine)
    with Session(engine) as session:
        session.add_all(
            [
                Course(
                    id="intro",
                    name="Introdução",
                    short_name="Introdução",
                    hours=60,
                    period=1,
                    type="mandatory",
                ),
                Course(
                    id="data",
                    name="Estruturas",
                    short_name="Estruturas",
                    hours=60,
                    period=2,
                    type="mandatory",
                ),
            ]
        )
        session.flush()
        session.add(Prerequisite(course_id="data", prerequisite_id="intro"))
        session.commit()

    def sessions():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = sessions
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    engine.dispose()
    if url:
        with admin.begin() as connection:
            connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        admin.dispose()


@pytest.fixture
def accounts(client):
    from app.core.config import get_settings
    from app.core.database import get_session
    from app.main import app
    from app.modules.personal.models import Student, User
    from app.modules.personal.security import passwords

    get_settings().allowed_origins = ["http://testserver"]
    with next(app.dependency_overrides[get_session]()) as db:
        for email, role, registration in [
            ("a@example.org", "student", "A"),
            ("b@example.org", "student", "B"),
            ("coord@example.org", "coordination", None),
        ]:
            user = User(email=email, role=role, password_hash=passwords.hash("test-secret"))
            db.add(user)
            db.flush()
            if registration:
                db.add(Student(user_id=user.id, registration=registration))
        db.commit()
    return client
