"""A migração 0008 corrige dados conhecidos sem perder histórico, planos ou edições."""

import json
import os
from pathlib import Path
from uuid import uuid4

import pytest
from alembic.config import Config
from sqlalchemy import create_engine, event, text

from alembic import command

BOM_ID = "ia:﻿cin0044"


def engines(tmp_path):
    # As migrações anteriores alteram restrições e exigem PostgreSQL.
    url = os.environ.get("TEST_DATABASE_URL")
    if url:
        schema = "test_0008_" + uuid4().hex
        admin = create_engine(url)
        with admin.begin() as connection:
            connection.execute(text(f'CREATE SCHEMA "{schema}"'))
        engine = create_engine(url)

        @event.listens_for(engine, "connect")
        def search_path(dbapi_connection, _):
            dbapi_connection.autocommit = True
            dbapi_connection.execute(f'SET search_path TO "{schema}"')
            dbapi_connection.autocommit = False

        yield "postgresql", engine, (admin, schema)


def course(connection, course_id, curriculum, name, hours, period, kind="mandatory"):
    connection.execute(
        text(
            "INSERT INTO courses (id, curriculum_id, name, short_name, hours, period, type) "
            "VALUES (:id, :curriculum, :name, :name, :hours, :period, :type)"
        ),
        {
            "id": course_id,
            "curriculum": curriculum,
            "name": name,
            "hours": hours,
            "period": period,
            "type": kind,
        },
    )


def populate_0007(connection):
    for curriculum in ["IA-2025", "CC-2024"]:
        connection.execute(
            text(
                "INSERT INTO curricula (id, program, valid_from, source_url) "
                "VALUES (:id, :program, '2024.1', 'https://example.test')"
            ),
            {"id": curriculum, "program": curriculum[:2]},
        )
    course(connection, "ip", "SI-demo", "Introdução à Programação", 120, 1)
    course(connection, "cad", "SI-demo", "Concepção de Artefatos Digitais", 60, 1)
    course(connection, "bd", "SI-demo", "Nome editado pela coordenação", 60, 3)
    course(connection, "cc:cin0039", "CC-2024", "COMPUTAÇÃO QU NTICA", 60, None, "elective")
    course(connection, "ia:cin0132", "IA-2025", "MATEMÁTICA DISCRETA", 60, 1)
    course(connection, BOM_ID, "IA-2025", "COMPUTAÇÃO EVOLUCIONÁRIA", 60, None, "elective")
    connection.execute(
        text("UPDATE courses SET source_code = :code WHERE id = :id"),
        {"code": "﻿CIN0044", "id": BOM_ID},
    )
    connection.execute(
        text("INSERT INTO prerequisites VALUES (:course, 'ia:cin0132')"), {"course": BOM_ID}
    )
    connection.execute(
        text(
            "INSERT INTO users (id, email, password_hash, role, active) "
            "VALUES ('u1', 'ia@example.test', 'x', 'student', true)"
        )
    )
    connection.execute(
        text(
            "INSERT INTO students (id, user_id, registration, program, start_term, "
            "coordination_managed, current_period, history_revision) "
            "VALUES ('s1', 'u1', '1', 'IA', '2025.1', false, 3, 1)"
        )
    )
    payload = {
        "records": [{"course_id": BOM_ID, "academic_term": "2025.2", "status": "completed"}],
        "source": "Informado pelo estudante",
        "source_reference": "manual",
    }
    connection.execute(
        text(
            "INSERT INTO history_imports (id, student_id, revision, author_id, created_at, "
            "content_hash, payload, warnings) VALUES ('h1', 's1', 1, 'u1', CURRENT_TIMESTAMP, "
            "'hash', :payload, :warnings)"
        ),
        {
            "payload": json.dumps(payload),
            "warnings": json.dumps(
                [{"course_id": BOM_ID, "missing_prerequisite_ids": [BOM_ID], "message": "x"}]
            ),
        },
    )
    connection.execute(
        text(
            "INSERT INTO academic_records (id, import_id, course_id, academic_term, status) "
            "VALUES ('r1', 'h1', :course, '2025.2', 'completed')"
        ),
        {"course": BOM_ID},
    )
    connection.execute(
        text(
            "INSERT INTO plans (id, student_id, name, target_term, planned_ids, "
            "hypothetical_ids, course_layout, version, created_at, updated_at) VALUES "
            "('p1', 's1', 'Plano', '2026.1', :planned, '[]', :layout, 1, "
            "CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
        ),
        {
            "planned": json.dumps([BOM_ID]),
            "layout": json.dumps({BOM_ID: {"period": 4, "order": 0}}),
        },
    )


@pytest.mark.skipif(
    not os.environ.get("TEST_DATABASE_URL"),
    reason="TEST_DATABASE_URL is required for real PostgreSQL",
)
def test_0008_fixes_known_values_and_moves_references(tmp_path):
    for dialect, engine, cleanup in engines(tmp_path):
        config = Config(str(Path(__file__).parents[1] / "alembic.ini"))
        config.set_main_option("script_location", str(Path(__file__).parents[1] / "alembic"))
        try:
            with engine.begin() as connection:
                config.attributes["connection"] = connection
                command.upgrade(config, "0007")
                populate_0007(connection)
                command.upgrade(config, "head")
                value = connection.execute
                assert value(text("SELECT id FROM curricula WHERE program = 'SI'")).all() == [
                    ("SI-2024",)
                ], dialect
                assert value(
                    text(
                        "SELECT profile_elective_hours, standard_semesters "
                        "FROM curricula WHERE id = 'SI-2024'"
                    )
                ).one() == (600, 8)
                hours = dict(
                    value(text("SELECT id, hours FROM courses WHERE id IN ('ip', 'cad')")).all()
                )
                # A página de SI inverte as cargas; vale a carga cursada: IP 120h e CAD 60h.
                assert hours == {"ip": 120, "cad": 60}
                codes = dict(
                    value(text("SELECT id, source_code FROM courses WHERE id = 'ip'")).all()
                )
                assert codes == {"ip": "CIN0133"}
                assert value(text("SELECT name FROM courses WHERE id = 'bd'")).scalar() == (
                    "Nome editado pela coordenação"
                )
                assert value(
                    text("SELECT curriculum_id FROM courses WHERE id = 'bd'")
                ).scalar() == ("SI-2024")
                assert value(text("SELECT name FROM courses WHERE id = 'cc:cin0039'")).scalar() == (
                    "COMPUTAÇÃO QUÂNTICA"
                )
                assert (
                    value(
                        text("SELECT count(*) FROM courses WHERE id = :id"), {"id": BOM_ID}
                    ).scalar()
                    == 0
                )
                assert value(
                    text("SELECT source_code FROM courses WHERE id = 'ia:cin0044'")
                ).scalar() == ("CIN0044")
                assert value(text("SELECT course_id FROM prerequisites")).scalar() == "ia:cin0044"
                assert value(text("SELECT course_id FROM academic_records")).scalar() == (
                    "ia:cin0044"
                )
                plan = value(text("SELECT planned_ids, course_layout FROM plans")).one()
                planned, layout = (json.loads(x) if isinstance(x, str) else x for x in plan)
                assert planned == ["ia:cin0044"]
                assert list(layout) == ["ia:cin0044"]
                imported = value(text("SELECT payload, warnings FROM history_imports")).one()
                payload, warnings = (json.loads(x) if isinstance(x, str) else x for x in imported)
                assert payload["records"][0]["course_id"] == "ia:cin0044"
                assert warnings[0]["missing_prerequisite_ids"] == ["ia:cin0044"]
                command.downgrade(config, "0007")
                assert value(
                    text("SELECT curriculum_id FROM courses WHERE id = 'ip'")
                ).scalar() == ("SI-demo")
        finally:
            engine.dispose()
            if cleanup:
                admin, schema = cleanup
                with admin.begin() as connection:
                    connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
                admin.dispose()


@pytest.mark.parametrize("filename", ["cc_2024", "ec_2024", "ia_2025", "si_2024"])
def test_catalog_has_clean_identifiers_and_names(filename):
    courses = json.loads(
        (Path(__file__).parents[1] / "app" / "data" / f"curriculum_{filename}.json").read_text()
    )
    for item in courses:
        for key in ("id", "source_code", "name", "short_name"):
            value = item.get(key) or ""
            assert value == value.strip() and "  " not in value, (key, value)
            assert all(ord(ch) >= 32 and ch not in "﻿​" for ch in value), (key, value)
        assert item["id"].isascii()
        for typo in ("QU NTICA", "SUSTEMAS", "LINGUA "):
            assert typo not in item["name"]
