"""Run with TEST_DATABASE_URL against PostgreSQL; each case owns a random schema."""

import os
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from uuid import uuid4

import pytest
from alembic.config import Config
from sqlalchemy import create_engine, event, func, select, text
from sqlalchemy.orm import Session
from test_personal_flow import history, import_history, login, record

from alembic import command
from app.modules.curriculum.models import Course, Prerequisite
from app.seed import seed

pytestmark = pytest.mark.skipif(
    not os.environ.get("TEST_DATABASE_URL"),
    reason="TEST_DATABASE_URL is required for real PostgreSQL",
)


@pytest.mark.parametrize("preexisting", [False, True])
def test_migrations_preserve_catalog_and_seed_is_idempotent(preexisting):
    url = os.environ["TEST_DATABASE_URL"]
    admin = create_engine(url)
    schema = "test_migration_" + uuid4().hex
    with admin.begin() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    engine = create_engine(url)

    @event.listens_for(engine, "connect")
    def search_path(dbapi_connection, _):
        dbapi_connection.autocommit = True
        dbapi_connection.execute(f'SET search_path TO "{schema}"')
        dbapi_connection.autocommit = False

    config = Config(str(Path(__file__).parents[1] / "alembic.ini"))
    config.set_main_option("script_location", str(Path(__file__).parents[1] / "alembic"))
    try:
        if preexisting:
            with engine.begin() as connection:
                config.attributes["connection"] = connection
                command.upgrade(config, "0002")
            with Session(engine) as db:
                seed(db)
                db.get(Course, "ip").name = "Institutional custom name"
                db.commit()
        with engine.begin() as connection:
            config.attributes["connection"] = connection
            command.upgrade(config, "head")
        with Session(engine) as db:
            seed(db)
            before = (
                db.scalar(select(func.count()).select_from(Course)),
                db.scalar(select(func.count()).select_from(Prerequisite)),
            )
            seed(db)
            after = (
                db.scalar(select(func.count()).select_from(Course)),
                db.scalar(select(func.count()).select_from(Prerequisite)),
            )
            assert before == after
            assert before[0] > 40
            if preexisting:
                assert db.get(Course, "ip").name == "Institutional custom name"
    finally:
        engine.dispose()
        with admin.begin() as connection:
            connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        admin.dispose()


def test_concurrent_plan_updates_do_not_overwrite(accounts):
    headers = login(accounts)
    plan = accounts.post(
        "/api/plans", headers=headers, json={"name": "Concurrent", "target_term": "2026.2"}
    ).json()
    payload = {
        "name": "saved",
        "target_term": "2026.2",
        "version": 1,
        "history_revision": 0,
        "planned_ids": [],
        "hypothetical_ids": [],
    }

    def save(name):
        return accounts.put(
            "/api/plans/" + plan["id"], headers=headers, json={**payload, "name": name}
        ).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(save, ["tab-one", "tab-two"]))
    assert sorted(results) == [200, 409]
    saved = accounts.get("/api/plans/" + plan["id"]).json()
    assert saved["version"] == 2
    assert saved["name"] in {"tab-one", "tab-two"}


def test_concurrent_identical_import_creates_one_revision(accounts):
    headers = login(accounts, "coord@example.org")
    payload = history([record()])
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: import_history(accounts, headers, payload), range(2)))
    assert [r.status_code for r in results] == [200, 200]
    assert [r.json()["revision"] for r in results] == [1, 1]
    assert sorted(r.json()["unchanged"] for r in results) == [False, True]


def test_saved_plan_survives_reconnecting_database_pool(accounts):
    from app.core.database import get_session
    from app.main import app

    headers = login(accounts)
    plan = accounts.post(
        "/api/plans", headers=headers, json={"name": "Persisted", "target_term": "2026.2"}
    ).json()
    with next(app.dependency_overrides[get_session]()) as db:
        engine = db.get_bind()
    engine.dispose()
    assert accounts.get("/api/plans/" + plan["id"]).json()["name"] == "Persisted"
