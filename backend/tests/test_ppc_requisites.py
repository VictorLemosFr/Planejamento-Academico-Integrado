"""Requisitos conferidos nos PPCs (programas dos componentes curriculares)."""

import json
import os
from pathlib import Path
from uuid import uuid4

import pytest
from alembic.config import Config
from sqlalchemy import create_engine, event, text

from alembic import command
from app.modules.constraints.service import CurriculumGraph
from app.modules.curriculum.catalog import CATALOGS
from app.modules.personal.service import evaluate

DATA = Path(__file__).parents[1] / "app" / "data"


def catalog(filename):
    return {c["id"]: c for c in json.loads((DATA / filename).read_text())}


@pytest.mark.parametrize("entry", CATALOGS, ids=lambda c: c["id"])
def test_mandatory_hours_match_the_published_total(entry):
    courses = catalog(entry["filename"]).values()
    CurriculumGraph(list(courses))
    total = sum(c["hours"] for c in courses if c["type"] == "mandatory")
    assert total == entry["official_mandatory_hours"]


@pytest.mark.parametrize("entry", CATALOGS, ids=lambda c: c["id"])
def test_mandatory_prerequisites_come_from_earlier_periods(entry):
    courses = catalog(entry["filename"])
    for course in courses.values():
        if course["type"] != "mandatory":
            continue
        for prerequisite in course["prerequisite_ids"]:
            required = courses[prerequisite]
            assert required["type"] == "mandatory"
            assert required["period"] < course["period"], (course["id"], prerequisite)


def test_known_requisites_from_each_ppc():
    si, cc = catalog("curriculum_si_2024.json"), catalog("curriculum_cc_2024.json")
    ec, ia = catalog("curriculum_ec_2024.json"), catalog("curriculum_ia_2025.json")
    assert si["amcd"]["prerequisite_ids"] == ["avl", "ip"]
    assert si["sad"]["prerequisite_ids"] == ["estat", "iesi"]
    assert si["ip"]["hours"] == 120 and si["cad"]["hours"] == 60
    assert si["tdei"]["name"] == "Tecnologia, Diversidade, Equidade e Inclusão"
    assert sorted(cc["cc:cin0150"]["prerequisite_ids"]) == ["cc:cin0140", "cc:cin0148"]
    assert cc["cc:cin0133"]["hours"] == 120 and cc["cc:cin0139"]["hours"] == 120
    lab = next(c for c in ec.values() if c["name"] == "LABORATÓRIO DE SISTEMAS DIGITAIS")
    theory = next(c for c in ec.values() if c["name"] == "SISTEMAS DIGITAIS")
    assert lab["corequisite_ids"] == [theory["id"]]
    assert theory["corequisite_ids"] == [lab["id"]]
    assert ia["ia:cin0121"]["prerequisite_status"] == "unverified"
    assert ia["ia:cin0146"]["hours"] == 30


def test_planning_a_course_requires_its_corequisite_together():
    courses = [
        {"id": "t", "name": "Teoria", "short_name": "T", "hours": 60, "period": 1,
         "type": "mandatory", "prerequisite_ids": [], "corequisite_ids": ["l"]},
        {"id": "l", "name": "Lab", "short_name": "L", "hours": 30, "period": 1,
         "type": "mandatory", "prerequisite_ids": [], "corequisite_ids": ["t"]},
    ]  # fmt: skip
    history = {"revision": 0, "awaiting_import": True, "current_period": 1, "records": []}
    alone = evaluate(courses, history, planned_ids=["t"])
    assert not alone["valid"] and "Co-requisito" in alone["problems"]["t"][0]
    assert evaluate(courses, history, planned_ids=["t", "l"])["valid"]
    done = {
        **history,
        "records": [{"course_id": "l", "academic_term": "2025.1", "status": "completed"}],
    }
    assert evaluate(courses, done, planned_ids=["t"])["valid"]


@pytest.mark.skipif(
    not os.environ.get("TEST_DATABASE_URL"),
    reason="TEST_DATABASE_URL is required for real PostgreSQL",
)
def test_0009_adds_requisites_and_fixes_only_known_hours():
    url = os.environ["TEST_DATABASE_URL"]
    schema = "test_0009_" + uuid4().hex
    admin = create_engine(url)
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
    rows = [
        ("cc:cin0133", "CC-2024", 60, 1, "mandatory"),
        ("cc:cin0139", "CC-2024", 90, 3, "mandatory"),
        ("cc:cin0140", "CC-2024", 60, 3, "mandatory"),
        ("cc:cin0148", "CC-2024", 60, 5, "mandatory"),
        ("cc:cin0150", "CC-2024", 60, 6, "mandatory"),
    ]
    try:
        with engine.begin() as connection:
            config.attributes["connection"] = connection
            command.upgrade(config, "0008")
            connection.execute(
                text(
                    "INSERT INTO curricula (id, program, valid_from, source_url) "
                    "VALUES ('CC-2024', 'CC', '2024.1', 'https://example.test')"
                )
            )
            for course_id, curriculum, hours, period, kind in rows:
                connection.execute(
                    text(
                        "INSERT INTO courses (id, curriculum_id, name, short_name, hours, "
                        "period, type) VALUES (:id, :c, :id, :id, :h, :p, :t)"
                    ),
                    {"id": course_id, "c": curriculum, "h": hours, "p": period, "t": kind},
                )
            command.upgrade(config, "head")
            value = connection.execute
            hours = dict(value(text("SELECT id, hours FROM courses")).all())
            assert hours["cc:cin0133"] == 120
            assert hours["cc:cin0139"] == 90  # valor editado é preservado
            prerequisites = value(
                text("SELECT prerequisite_id FROM prerequisites WHERE course_id = 'cc:cin0150'")
            ).scalars()
            assert sorted(prerequisites) == ["cc:cin0140", "cc:cin0148"]
            status = value(
                text("SELECT prerequisite_status FROM courses WHERE id = 'cc:cin0150'")
            ).scalar()
            assert status == "verified"
            command.downgrade(config, "0008")
            command.upgrade(config, "head")
    finally:
        engine.dispose()
        with admin.begin() as connection:
            connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        admin.dispose()
