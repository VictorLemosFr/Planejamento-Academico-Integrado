ORIGIN = {"Origin": "http://testserver"}


def signup(client, **changes):
    payload = {
        "email": "New.Student@example.org",
        "password": "long-secret",
        "registration": "20260042",
        "current_period": 3,
        "start_term": "2024.1",
        "program": "SI",
    }
    return client.post("/api/auth/register", headers=ORIGIN, json={**payload, **changes})


def test_signup_creates_student_and_session(client):
    result = signup(client)
    assert result.status_code == 201, result.text
    assert result.json()["user"]["email"] == "new.student@example.org"
    assert result.json()["student"] == {"program": "SI"}
    assert result.json()["csrf_token"]
    assert client.get("/api/auth/me").json()["student"] == result.json()["student"]
    assert client.get("/api/me/progression").status_code == 200


def test_signup_requires_origin_and_rejects_invalid_or_duplicate_data(client):
    assert (
        client.post(
            "/api/auth/register",
            json={
                "email": "student@example.org",
                "password": "long-secret",
                "registration": "A123",
                "current_period": 1,
                "start_term": "2024.1",
                "program": "SI",
            },
        ).status_code
        == 403
    )
    assert signup(client, program="OTHER").status_code == 422
    assert signup(client, password="short").status_code == 422
    assert signup(client, current_period=21).status_code == 422
    assert signup(client).status_code == 201
    assert signup(client, registration="other").status_code == 409
    assert signup(client, email="other@example.org").status_code == 409


def test_student_records_and_revises_own_history(accounts):
    result = signup(accounts)
    assert result.status_code == 201
    headers = {**ORIGIN, "X-CSRF-Token": result.json()["csrf_token"]}
    history = {
        "start_term": "2024.1",
        "current_period": 3,
        "records": [
            {"course_id": "intro", "academic_term": "2024.1", "status": "failed"},
            {"course_id": "intro", "academic_term": "2024.2", "status": "completed"},
            {"course_id": "data", "academic_term": "2025.1", "status": "in_progress"},
        ],
    }
    saved = accounts.put("/api/me/history", headers=headers, json=history)
    assert saved.status_code == 200, saved.text
    assert saved.json()["revision"] == 1
    current = accounts.get("/api/me/history").json()
    assert current["start_term"] == "2024.1"
    assert current["import"]["source"] == "Informado pelo estudante"
    assert sorted(current["records"], key=lambda r: (r["course_id"], r["academic_term"])) == sorted(
        history["records"], key=lambda r: (r["course_id"], r["academic_term"])
    )
    progression = accounts.get("/api/me/progression").json()
    assert progression["official_completed_ids"] == ["intro"]
    assert progression["in_progress_ids"] == ["data"]

    revised = accounts.put(
        "/api/me/history",
        headers=headers,
        json={**history, "records": [history["records"][1]]},
    )
    assert revised.status_code == 200
    assert revised.json()["revision"] == 2
    assert accounts.get("/api/me/history").json()["records"] == [history["records"][1]]


def test_self_report_requires_own_session_and_valid_course(accounts):
    report = {"start_term": "2024.1", "current_period": 2, "records": []}
    assert accounts.put("/api/me/history", headers=ORIGIN, json=report).status_code == 401
    result = signup(accounts)
    headers = {**ORIGIN, "X-CSRF-Token": result.json()["csrf_token"]}
    assert accounts.put("/api/me/history", headers=ORIGIN, json=report).status_code == 403
    invalid = {
        **report,
        "records": [{"course_id": "unknown", "academic_term": "2024.1", "status": "completed"}],
    }
    assert accounts.put("/api/me/history", headers=headers, json=invalid).status_code == 422
    before_entry = {
        **report,
        "records": [{"course_id": "intro", "academic_term": "2023.2", "status": "completed"}],
    }
    assert accounts.put("/api/me/history", headers=headers, json=before_entry).status_code == 422
    assert accounts.get("/api/me/history").json()["revision"] == 0


def test_legacy_admin_import_does_not_attach_history_to_public_signup(accounts):
    assert signup(accounts).status_code == 201
    coord = accounts.post(
        "/api/auth/login",
        headers=ORIGIN,
        json={"email": "coord@example.org", "password": "test-secret"},
    ).json()
    headers = {**ORIGIN, "X-CSRF-Token": coord["csrf_token"]}
    payload = {
        "schema_version": 1,
        "source": "coordination",
        "source_reference": "test",
        "current_period": 2,
        "records": [{"course_id": "intro", "academic_term": "2026.1", "status": "completed"}],
    }
    assert (
        accounts.put(
            "/api/admin/students/20260042/history", headers=headers, json=payload
        ).status_code
        == 409
    )
    assert (
        accounts.put("/api/admin/students/A/history", headers=headers, json=payload).status_code
        == 200
    )


def test_old_admin_import_remains_idempotent_without_start_term(accounts):
    import json
    from hashlib import sha256

    from sqlalchemy import select

    from app.core.database import get_session
    from app.main import app
    from app.modules.personal.models import HistoryImport, Student, User

    payload = {
        "schema_version": 1,
        "source": "coordination",
        "source_reference": "legacy",
        "current_period": 2,
        "records": [],
    }
    with next(app.dependency_overrides[get_session]()) as session:
        student = session.scalar(select(Student).where(Student.registration == "A"))
        author = session.scalar(select(User).where(User.email == "coord@example.org"))
        student.history_revision = 1
        session.add(
            HistoryImport(
                student_id=student.id,
                revision=1,
                author_id=author.id,
                payload=payload,
                content_hash=sha256(
                    json.dumps(payload, sort_keys=True, ensure_ascii=False).encode()
                ).hexdigest(),
                warnings=[],
            )
        )
        session.commit()
    coord = accounts.post(
        "/api/auth/login",
        headers=ORIGIN,
        json={"email": "coord@example.org", "password": "test-secret"},
    ).json()
    result = accounts.put(
        "/api/admin/students/A/history",
        headers={**ORIGIN, "X-CSRF-Token": coord["csrf_token"]},
        json=payload,
    )
    assert result.status_code == 200
    assert result.json()["revision"] == 1
    assert result.json()["unchanged"] is True


def test_other_programs_never_receive_si_planning(client):
    for program in ("CC", "IA", "EC"):
        result = signup(
            client,
            email=f"{program}@example.org",
            registration=f"registration-{program}",
            program=program,
        )
        assert result.status_code == 201, result.text
        assert result.json()["student"]["program"] == program
        assert client.get("/api/me/progression").status_code == 409
        assert client.get("/api/plans").status_code == 409
        assert (
            client.post(
                "/api/plans",
                headers={**ORIGIN, "X-CSRF-Token": result.json()["csrf_token"]},
                json={"name": "Wrong map", "target_term": "2026.2"},
            ).status_code
            == 409
        )


def test_migration_assigns_existing_students_to_si_without_start_term(tmp_path):
    from pathlib import Path

    from alembic.config import Config
    from sqlalchemy import create_engine, text

    from alembic import command

    engine = create_engine(f"sqlite:///{tmp_path / 'students.db'}")
    config = Config("alembic.ini")
    config.set_main_option("script_location", str(Path(__file__).parents[1] / "alembic"))
    with engine.begin() as connection:
        config.attributes["connection"] = connection
        connection.execute(text("CREATE TABLE students (id VARCHAR(36) PRIMARY KEY)"))
        command.stamp(config, "0004")
        connection.execute(text("INSERT INTO students (id) VALUES ('legacy')"))
        command.upgrade(config, "head")
        result = connection.execute(
            text("SELECT program, start_term, coordination_managed FROM students WHERE id='legacy'")
        ).one()
        assert result == ("SI", None, 1)
    engine.dispose()


def test_migration_preserves_public_account_origin(tmp_path):
    from pathlib import Path

    from alembic.config import Config
    from sqlalchemy import create_engine, text

    from alembic import command

    engine = create_engine(f"sqlite:///{tmp_path / 'public-student.db'}")
    config = Config("alembic.ini")
    config.set_main_option("script_location", str(Path(__file__).parents[1] / "alembic"))
    with engine.begin() as connection:
        config.attributes["connection"] = connection
        connection.execute(text("CREATE TABLE students (id VARCHAR(36) PRIMARY KEY)"))
        command.stamp(config, "0004")
        command.upgrade(config, "0005")
        connection.execute(
            text("INSERT INTO students (id, registration_verified) VALUES ('public', 0)")
        )
        command.upgrade(config, "head")
        managed = connection.execute(
            text("SELECT coordination_managed FROM students WHERE id='public'")
        ).scalar_one()
        assert managed == 0
    engine.dispose()
