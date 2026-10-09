from app.modules.constraints.service import CurriculumGraph
from app.modules.progression.service import course_status


def simulate(courses, *, current_period, completed_ids, planned_ids, action=None):
    graph = CurriculumGraph(courses)
    completed, planned = set(completed_ids), set(planned_ids)
    graph.require_known(completed | planned)
    if completed & planned:
        raise ValueError("Uma disciplina não pode estar concluída e planejada ao mesmo tempo.")
    for course_id in completed | planned:
        if graph.missing(course_id, completed):
            raise ValueError("O cenário contém disciplinas com pré-requisitos não concluídos.")

    if action:
        course_id, kind = action["course_id"], action["kind"]
        graph.require_known({course_id})
        if kind in {"approve", "plan"}:
            if graph.missing(course_id, completed):
                raise ValueError("Conclua os pré-requisitos antes de simular esta ação.")
            if kind == "approve":
                completed.add(course_id)
                planned.discard(course_id)
            elif course_id not in completed:
                planned.add(course_id)
        elif kind == "revoke":
            affected = graph.descendants(course_id) | {course_id}
            completed -= affected
            planned -= affected
        elif kind == "unplan":
            planned.discard(course_id)
        else:
            raise ValueError("Ação de simulação desconhecida.")

    result = []
    for course in courses:
        course_id = course["id"]
        missing = graph.missing(course_id, completed)
        dependents = sorted(graph.descendants(course_id))
        result.append(
            {
                **course,
                "status": course_status(course, current_period, completed, planned, missing),
                "missing_prerequisite_ids": missing,
                "dependent_ids": dependents,
                "critical": len(dependents) >= 6,
            }
        )

    return {
        "current_period": current_period,
        "completed_ids": sorted(completed),
        "planned_ids": sorted(planned),
        "planned_hours": sum(c["hours"] for c in courses if c["id"] in planned),
        "courses": result,
        "counts": {
            status: sum(c["status"] == status for c in result)
            for status in ["completed", "planned", "available", "pending", "locked"]
        },
        "warnings": [
            "A oferta de disciplinas ainda não está disponível. "
            "A simulação valida apenas pré-requisitos."
        ],
    }
