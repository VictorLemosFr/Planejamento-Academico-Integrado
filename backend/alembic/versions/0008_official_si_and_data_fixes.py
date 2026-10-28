"""Publish SI as the official 2024 matrix, record graduation requirements and fix data.

The seed only inserts missing rows, so corrections for populated databases live here.
Each correction only replaces the exact value known to be wrong, preserving any edit
made after the original load.
"""

import json

import sqlalchemy as sa

from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None

SI_URL = "https://portal.cin.ufpe.br/graduacao/sistemas-de-informacao/"
REQUIREMENTS = {
    # id: (obrigatórias, eletivas de perfil, livres, complementares, extensão, total, semestres)
    "SI-2024": (1770, 600, 180, 150, None, 3000, 8),
    "CC-2024": (1530, 780, 300, 270, 320, 3200, 9),
    "IA-2025": (1680, 660, 300, 240, None, 3200, 9),
    "EC-2024": (2550, 480, 90, 120, None, 3600, 10),
}
COLUMNS = (
    "official_mandatory_hours",
    "profile_elective_hours",
    "free_elective_hours",
    "complementary_hours",
    "extension_hours",
    "total_hours",
    "standard_semesters",
)
SI_CODES = {
    "mdc": "CIN0132", "ip": "CIN0133", "sdig": "CIN0130", "cad": "CIN0131",
    "calc1": "MA026", "edoo": "CIN0135", "acso": "CIN0134", "ds": "CIN0136",
    "avl": "CIN0138", "algo": "CIN0140", "bd": "CIN0137", "iesi": "CIN0139",
    "estat": "CIN0142", "logica": "CIN0141", "isdrc": "CIN0143", "amcd": "CIN0144",
    "empinf": "CIN0183", "asesi": "CIN0184", "admc": "CGA0002", "arqemp": "CIN0187",
    "gpn": "CIN0186", "estagio": "CIN0188", "ctc": "CIN0190", "apsi": "CIN0189",
    "tcc": "CIN0191", "sad": "CIN0192", "gdic": "CIN0193", "sis": "CIN0158",
    "ihc": "CIN0194", "tsi": "CIN0195", "ggti": "CIN0196", "gppti": "CIN0197",
    "inovsi": "CIN0198", "nuvem": "CIN0177", "ccg": "CT528", "ingles": "LE037",
    "libras": "LE716", "tslog": "CIN0185", "gprod": "CIN0199", "gpe": "CGA0001",
    "findig": "EC477", "aear": "CIN0162", "er": "IF1008", "fts": "CIN0168",
    "mgp": "CIN0165", "pgqs": "CIN0166", "pnt": "CIN0167", "cc": "CIN0129",
    "rn": "CIN0037", "bdnc": "CIN0155", "aam": "CIN0043", "visdados": "CIN0152",
    "iap": "CIN0040", "iar": "CIN0041", "tdei": "CIN0161", "eajc": "CIN0121",
}  # fmt: skip
TDEI_OLD = "Tecnologia, Diversidade, Equidade e Inclusão"
TDEI = "Tecnologia, Diversidade e Inclusão"
# (id, coluna, valor errado conhecido, valor correto)
FIXES = (
    ("tdei", "name", TDEI_OLD, TDEI),
    ("tdei", "short_name", TDEI_OLD, TDEI),
    ("cc:cin0039", "name", "COMPUTAÇÃO QU NTICA", "COMPUTAÇÃO QUÂNTICA"),
    ("cc:cin0039", "short_name", "COMPUTAÇÃO QU NTICA", "COMPUTAÇÃO QUÂNTICA"),
    ("ia:cin0134", "name", "ARQUITETURA DE COMPUTADORES E SUSTEMAS OPERACIONAIS",
     "ARQUITETURA DE COMPUTADORES E SISTEMAS OPERACIONAIS"),
    ("ia:cin0134", "short_name", "ARQUITETURA DE COMPUTADORES E SUSTEMAS OPERACIONAIS",
     "ARQUITETURA DE COMPUTADORES E SISTEMAS OPERACIONAIS"),
    ("ia:le037", "name", "LINGUA INGLESA INSTRUMENTAL 1", "LÍNGUA INGLESA INSTRUMENTAL 1"),
    ("ia:le037", "short_name", "LINGUA INGLESA INSTRUMENTAL 1", "LÍNGUA INGLESA INSTRUMENTAL 1"),
)  # fmt: skip
# A transcrição de IA trouxe um caractere invisível (U+FEFF) no identificador.
RENAMES = {"ia:﻿cin0044": "ia:cin0044"}


def json_value(value):
    return json.loads(value) if isinstance(value, str) else value


def rename_course(connection, old, new):
    columns = [
        "id", "curriculum_id", "source_code", "prerequisite_status",
        "name", "short_name", "hours", "period", "type",
    ]  # fmt: skip
    row = (
        connection.execute(
            sa.text(f"SELECT {', '.join(columns)} FROM courses WHERE id = :id"), {"id": old}
        )
        .mappings()
        .first()
    )
    if row is None:
        return
    exists = connection.execute(sa.text("SELECT 1 FROM courses WHERE id = :id"), {"id": new})
    if exists.first() is None:
        values = {**row, "id": new, "source_code": (row["source_code"] or "").replace("﻿", "")}
        connection.execute(
            sa.text(
                f"INSERT INTO courses ({', '.join(columns)}) "
                f"VALUES ({', '.join(':' + column for column in columns)})"
            ),
            values,
        )
    for table, column in [
        ("prerequisites", "course_id"),
        ("prerequisites", "prerequisite_id"),
        ("academic_records", "course_id"),
    ]:
        connection.execute(
            sa.text(f"UPDATE {table} SET {column} = :new WHERE {column} = :old"),
            {"new": new, "old": old},
        )

    def swap(ids):
        return [new if value == old else value for value in ids]

    for plan in connection.execute(
        sa.text("SELECT id, planned_ids, hypothetical_ids, course_layout FROM plans")
    ).mappings():
        planned, hypothetical = (
            json_value(plan["planned_ids"]),
            json_value(plan["hypothetical_ids"]),
        )
        layout = json_value(plan["course_layout"]) or {}
        if old in planned or old in hypothetical or old in layout:
            connection.execute(
                sa.text(
                    "UPDATE plans SET planned_ids = :planned, hypothetical_ids = :hypothetical, "
                    "course_layout = :layout WHERE id = :id"
                ),
                {
                    "id": plan["id"],
                    "planned": json.dumps(swap(planned)),
                    "hypothetical": json.dumps(swap(hypothetical)),
                    "layout": json.dumps({new if k == old else k: v for k, v in layout.items()}),
                },
            )
    for imported in connection.execute(
        sa.text("SELECT id, payload, warnings FROM history_imports")
    ).mappings():
        payload, warnings = json_value(imported["payload"]), json_value(imported["warnings"])
        if old not in json.dumps(payload, ensure_ascii=False) + json.dumps(
            warnings, ensure_ascii=False
        ):
            continue
        for record in payload.get("records", []):
            if record.get("course_id") == old:
                record["course_id"] = new
        for warning in warnings:
            if warning.get("course_id") == old:
                warning["course_id"] = new
            warning["missing_prerequisite_ids"] = swap(warning.get("missing_prerequisite_ids", []))
        connection.execute(
            sa.text(
                "UPDATE history_imports SET payload = :payload, warnings = :warnings WHERE id = :id"
            ),
            {
                "id": imported["id"],
                "payload": json.dumps(payload, ensure_ascii=False),
                "warnings": json.dumps(warnings, ensure_ascii=False),
            },
        )
    connection.execute(sa.text("DELETE FROM courses WHERE id = :id"), {"id": old})


def upgrade():
    with op.batch_alter_table("curricula") as batch:
        for column in COLUMNS:
            batch.add_column(sa.Column(column, sa.Integer(), nullable=True))
    connection = op.get_bind()
    # SI deixa de ser demonstrativa: os IDs das disciplinas são preservados.
    si_values = dict(zip(COLUMNS, REQUIREMENTS["SI-2024"], strict=True))
    connection.execute(
        sa.text(
            "INSERT INTO curricula (id, program, valid_from, source_url, "
            f"{', '.join(COLUMNS)}) VALUES ('SI-2024', 'SI', '2024.1', :url, "
            f"{', '.join(':' + column for column in COLUMNS)})"
        ),
        {"url": SI_URL, **si_values},
    )
    connection.execute(
        sa.text("UPDATE courses SET curriculum_id = 'SI-2024' WHERE curriculum_id = 'SI-demo'")
    )
    connection.execute(sa.text("DELETE FROM curricula WHERE id = 'SI-demo'"))
    with op.batch_alter_table("courses") as batch:
        batch.alter_column("curriculum_id", existing_type=sa.String(32), server_default="SI-2024")
    for curriculum_id, values in REQUIREMENTS.items():
        connection.execute(
            sa.text(
                f"UPDATE curricula SET {', '.join(f'{c} = :{c}' for c in COLUMNS)} WHERE id = :id"
            ),
            {"id": curriculum_id, **dict(zip(COLUMNS, values, strict=True))},
        )
    for course_id, code in SI_CODES.items():
        connection.execute(
            sa.text(
                "UPDATE courses SET source_code = :code "
                "WHERE id = :id AND curriculum_id = 'SI-2024' AND source_code IS NULL"
            ),
            {"id": course_id, "code": code},
        )
    for course_id, column, wrong, right in FIXES:
        connection.execute(
            sa.text(f"UPDATE courses SET {column} = :right WHERE id = :id AND {column} = :wrong"),
            {"id": course_id, "wrong": wrong, "right": right},
        )
    for old, new in RENAMES.items():
        rename_course(connection, old, new)


def downgrade():
    connection = op.get_bind()
    connection.execute(
        sa.text(
            "INSERT INTO curricula (id, program, valid_from, source_url, "
            f"{', '.join(COLUMNS)}) "
            "VALUES ('SI-demo', 'SI', '0000.1', 'app/data/curriculum.json', "
            f"{', '.join('NULL' for _ in COLUMNS)})"
        )
    )
    connection.execute(
        sa.text("UPDATE courses SET curriculum_id = 'SI-demo' WHERE curriculum_id = 'SI-2024'")
    )
    connection.execute(sa.text("DELETE FROM curricula WHERE id = 'SI-2024'"))
    with op.batch_alter_table("courses") as batch:
        batch.alter_column("curriculum_id", existing_type=sa.String(32), server_default="SI-demo")
    # As correções de grafia e o identificador sem U+FEFF são mantidos no downgrade.
    with op.batch_alter_table("curricula") as batch:
        for column in reversed(COLUMNS):
            batch.drop_column(column)
