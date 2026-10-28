"""History remains authoritative; hypothetical approvals belong to a plan only."""

import json
from hashlib import sha256

from fastapi import HTTPException
from sqlalchemy import select

from app.modules.constraints.service import CurriculumGraph
from app.modules.personal.models import AcademicRecord, HistoryImport
from app.modules.planning.forecast import summarize
from app.modules.progression.service import course_status

WARNING = (
    "A oferta ainda não está disponível. A validação considera apenas pré-requisitos cadastrados."
)
UNVERIFIED_PREREQUISITES = (
    "Os pré-requisitos desta matriz ainda não foram confirmados; "
    "o planejamento não comprova elegibilidade para matrícula."
)
PARTIALLY_VERIFIED = (
    "Pré-requisitos conferidos no PPC do curso, exceto em {count} disciplina(s) sinalizada(s); "
    "o planejamento não substitui a validação da matrícula no SIGAA."
)
COREQUISITE = "Co-requisito precisa ser cursado no mesmo semestre ou antes."


def history_view(session, student):
    imported = session.scalar(
        select(HistoryImport).where(
            HistoryImport.student_id == student.id,
            HistoryImport.revision == student.history_revision,
        )
    )
    return {
        "revision": student.history_revision,
        "awaiting_import": imported is None or not imported.payload["records"],
        "current_period": student.current_period,
        "start_term": student.start_term,
        "records": imported.payload["records"] if imported else [],
        "import": {
            "id": imported.id,
            "author_id": imported.author_id,
            "created_at": imported.created_at,
            "content_hash": imported.content_hash,
            "source": imported.payload["source"],
            "source_reference": imported.payload["source_reference"],
            "schema_version": 1,
        }
        if imported
        else None,
        "warnings": imported.warnings if imported else [],
    }


def official_sets(history):
    completed = {r["course_id"] for r in history["records"] if r["status"] == "completed"}
    latest = {}
    for record in history["records"]:
        previous = latest.get(record["course_id"])
        if previous is None or previous["academic_term"] < record["academic_term"]:
            latest[record["course_id"]] = record
    ongoing = {
        cid for cid, record in latest.items() if record["status"] == "in_progress"
    } - completed
    return completed, ongoing


def import_history(session, student, author, payload, courses):
    data = payload.model_dump(exclude_none=True)
    graph = CurriculumGraph(courses)
    seen = set()
    for index, record in enumerate(data["records"]):
        field = ["body", "records", index]
        if record["course_id"] not in graph.courses:
            raise HTTPException(
                422, [{"loc": field + ["course_id"], "msg": "Disciplina desconhecida."}]
            )
        key = (record["course_id"], record["academic_term"])
        if key in seen:
            raise HTTPException(
                422, [{"loc": field, "msg": "Tentativa duplicada ou contraditória."}]
            )
        seen.add(key)
    # Canonical order makes equivalent full files idempotent.
    data["records"].sort(key=lambda r: (r["course_id"], r["academic_term"]))
    digest = sha256(json.dumps(data, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    current = history_view(session, student)
    if current["import"] and current["import"]["content_hash"] == digest:
        return {
            "revision": student.history_revision,
            "warnings": current["warnings"],
            "unchanged": True,
        }
    warnings = []
    for record in data["records"]:
        if record["status"] == "failed":
            continue
        previous = {
            r["course_id"]
            for r in data["records"]
            if r["status"] == "completed" and r["academic_term"] < record["academic_term"]
        }
        if missing := graph.missing(record["course_id"], previous):
            warnings.append(
                {
                    "course_id": record["course_id"],
                    "academic_term": record["academic_term"],
                    "missing_prerequisite_ids": missing,
                    "message": "Pré-requisitos não constam como aprovados anteriormente.",
                }
            )
    student.history_revision += 1
    student.current_period = data["current_period"]
    if data.get("start_term") is not None:
        student.start_term = data["start_term"]
    imported = HistoryImport(
        student_id=student.id,
        revision=student.history_revision,
        author_id=author.id,
        payload=data,
        content_hash=digest,
        warnings=warnings,
    )
    session.add(imported)
    session.flush()
    session.add_all([AcademicRecord(import_id=imported.id, **r) for r in data["records"]])
    revision = student.history_revision
    session.commit()
    return {"revision": revision, "warnings": warnings, "unchanged": False}


def evaluate(
    courses,
    history,
    hypothetical_ids=(),
    planned_ids=(),
    action=None,
    course_layout=None,
    requirements=None,
):
    graph = CurriculumGraph(courses)
    official, ongoing = official_sets(history)
    hypothetical, planned = set(hypothetical_ids), set(planned_ids)
    layout = {cid: dict(position) for cid, position in (course_layout or {}).items()}
    graph.require_known(hypothetical | planned | layout.keys())
    if action:
        course_id, kind = action["course_id"], action["kind"]
        graph.require_known({course_id})
        if kind in {"approve", "revoke"} and course_id in official:
            raise ValueError("Aprovações oficiais são somente leitura.")
        if kind in {"approve", "plan"}:
            if graph.missing(course_id, official | hypothetical):
                raise ValueError("Conclua os pré-requisitos antes de simular esta ação.")
            if kind == "approve":
                hypothetical.add(course_id)
                planned.discard(course_id)
            else:
                if course_id in official | hypothetical | ongoing:
                    raise ValueError("Disciplina já concluída, simulada ou em andamento.")
                planned.add(course_id)
        elif kind == "revoke":
            affected = graph.descendants(course_id) | {course_id}
            hypothetical -= affected
            planned -= affected
        elif kind == "unplan":
            planned.discard(course_id)
    # Placement is a visual arrangement; it never grants academic completion.
    by_id = {course["id"]: course for course in courses}
    if action and action["kind"] == "unplan" and by_id[action["course_id"]]["type"] == "elective":
        layout.pop(action["course_id"], None)
    next_period = min(history["current_period"] + 1, 20)
    next_order = (
        max((pos["order"] for pos in layout.values() if pos["period"] == next_period), default=-1)
        + 1
    )
    for cid in sorted(planned):
        if by_id[cid]["type"] == "elective" and cid not in layout:
            layout[cid] = {"period": next_period, "order": next_order}
            next_order += 1
    completed = official | hypothetical
    problems = {}
    for cid in hypothetical | planned:
        issues = []
        if cid in official:
            issues.append("Disciplina já concluída no histórico registrado.")
        if cid in planned & ongoing:
            issues.append("Disciplina em andamento no histórico registrado.")
        if cid in hypothetical & planned:
            issues.append("Disciplina simultaneamente planejada e aprovada na hipótese.")
        if graph.missing(cid, completed):
            issues.append("Pré-requisitos não satisfeitos.")
        if cid in planned and any(
            co not in completed | ongoing | planned for co in graph.corequisites(cid)
        ):
            issues.append(COREQUISITE)
        if issues:
            problems[cid] = issues
    result = []
    for course in courses:
        cid = course["id"]
        missing = graph.missing(cid, completed)
        status = course_status(course, history["current_period"], completed, planned, missing)
        if cid in official:
            status = "completed"
        elif cid in hypothetical:
            status = "simulated"
        elif cid in ongoing:
            status = "in_progress"
        result.append(
            {
                **course,
                "status": status,
                "missing_prerequisite_ids": missing,
                "dependent_ids": sorted(graph.descendants(cid)),
                "critical": len(graph.descendants(cid)) >= 6,
            }
        )
    integralization, forecast = (
        summarize(courses, completed, ongoing, requirements, history)
        if requirements is not None
        else (None, None)
    )
    return {
        "integralization": integralization,
        "forecast": forecast,
        "course_layout": layout,
        "current_period": history["current_period"],
        "history_revision": history["revision"],
        "awaiting_import": history["awaiting_import"],
        "official_completed_ids": sorted(official),
        "hypothetical_ids": sorted(hypothetical),
        "planned_ids": sorted(planned),
        "completed_ids": sorted(completed),
        "in_progress_ids": sorted(ongoing),
        "planned_hours": sum(c["hours"] for c in courses if c["id"] in planned),
        "courses": result,
        "counts": {
            s: sum(c["status"] == s for c in result)
            for s in [
                "completed",
                "simulated",
                "in_progress",
                "planned",
                "available",
                "pending",
                "locked",
            ]
        },
        "valid": not problems,
        "problems": problems,
        "warnings": [WARNING] + verification_warning(courses),
    }


def verification_warning(courses):
    unverified = sum(course.get("prerequisite_status") == "unverified" for course in courses)
    if not unverified:
        return []
    if unverified == len(courses):
        return [UNVERIFIED_PREREQUISITES]
    return [PARTIALLY_VERIFIED.format(count=unverified)]


def plan_view(session, student, plan, courses, requirements=None):
    return {
        "id": plan.id,
        "name": plan.name,
        "target_term": plan.target_term,
        "version": plan.version,
        "created_at": plan.created_at,
        "updated_at": plan.updated_at,
        **evaluate(
            courses,
            history_view(session, student),
            plan.hypothetical_ids,
            plan.planned_ids,
            course_layout=plan.course_layout,
            requirements=requirements,
        ),
    }
