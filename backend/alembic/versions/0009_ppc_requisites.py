"""Load prerequisites and co-requisites confirmed in the official PPCs.

The requisites come from the "Programa de Componente Curricular" of each course in the
PPC of SI, CC, EC (2024) and IA, frozen in 0009_ppc_requisites.json so this migration
does not depend on files that may change later.

The migration only adds missing relations and marks confirmed courses as verified.
Hours fixed here only change when the stored value is the known wrong one.
"""

import json
from pathlib import Path

import sqlalchemy as sa

from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None

SNAPSHOT = json.loads((Path(__file__).with_name("0009_ppc_requisites.json")).read_text())
# A página pública informa 60h; o PPC informa a carga abaixo.
HOURS = (("cc:cin0133", 60, 120), ("cc:cin0139", 60, 120), ("ia:cin0146", 60, 30))


def upgrade():
    op.create_table(
        "corequisites",
        sa.Column("course_id", sa.String(40), sa.ForeignKey("courses.id"), primary_key=True),
        sa.Column("corequisite_id", sa.String(40), sa.ForeignKey("courses.id"), primary_key=True),
        sa.CheckConstraint("course_id <> corequisite_id", name="no_self_corequisite"),
    )
    connection = op.get_bind()
    existing = {row[0] for row in connection.execute(sa.text("SELECT id FROM courses"))}
    prerequisites = {
        tuple(row)
        for row in connection.execute(
            sa.text("SELECT course_id, prerequisite_id FROM prerequisites")
        )
    }
    for course_id, data in SNAPSHOT["courses"].items():
        if course_id not in existing:
            continue
        for prerequisite_id in data["prerequisite_ids"]:
            if prerequisite_id in existing and (course_id, prerequisite_id) not in prerequisites:
                connection.execute(
                    sa.text(
                        "INSERT INTO prerequisites (course_id, prerequisite_id) VALUES (:c, :p)"
                    ),
                    {"c": course_id, "p": prerequisite_id},
                )
        for corequisite_id in data["corequisite_ids"]:
            if corequisite_id in existing:
                connection.execute(
                    sa.text("INSERT INTO corequisites (course_id, corequisite_id) VALUES (:c, :p)"),
                    {"c": course_id, "p": corequisite_id},
                )
        if data["verified"]:
            connection.execute(
                sa.text("UPDATE courses SET prerequisite_status = 'verified' WHERE id = :id"),
                {"id": course_id},
            )
    for course_id, wrong, right in HOURS:
        connection.execute(
            sa.text("UPDATE courses SET hours = :right WHERE id = :id AND hours = :wrong"),
            {"id": course_id, "wrong": wrong, "right": right},
        )


def downgrade():
    connection = op.get_bind()
    for course_id, data in SNAPSHOT["courses"].items():
        if data["verified"]:
            connection.execute(
                sa.text("UPDATE courses SET prerequisite_status = 'unverified' WHERE id = :id"),
                {"id": course_id},
            )
    # Pré-requisitos adicionados permanecem: removê-los poderia apagar cadastros manuais.
    op.drop_table("corequisites")
