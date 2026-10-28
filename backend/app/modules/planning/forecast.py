"""Integralização por carga horária e previsão mínima de conclusão.

A previsão combina dois limites independentes:

1. Cadeia de pré-requisitos: num grafo sem ciclos, a maior sequência de obrigatórias
   pendentes que dependem umas das outras exige um semestre por elo, mesmo com carga
   ilimitada. É o caminho mais longo do DAG, calculado em ordem topológica.
2. Ritmo da grade: a carga pendente dividida pela carga média por semestre da própria
   matriz (obrigatórias + eletivas de perfil, dividido pela duração padrão).

A estimativa é o maior dos dois. Oferta, choque de horários, carga máxima, eletivas
livres, atividades complementares e extensão não entram no cálculo e são informadas
como premissas.
"""


def term_after(term, semesters):
    year, half = (int(part) for part in term.split("."))
    index = year * 2 + (half - 1) + semesters
    return f"{index // 2}.{index % 2 + 1}"


def current_term(start_term, current_period):
    return term_after(start_term, current_period - 1) if start_term else None


def longest_chain(courses, remaining):
    """Retorna a maior cadeia de pré-requisitos restrita às disciplinas pendentes."""
    by_id = {course["id"]: course for course in courses}
    depth, previous = {}, {}

    def visit(course_id):
        # O grafo já foi validado como acíclico pelo CurriculumGraph.
        if course_id in depth:
            return depth[course_id]
        best, best_parent = 0, None
        for parent in by_id[course_id]["prerequisite_ids"]:
            if parent in remaining and visit(parent) > best:
                best, best_parent = depth[parent], parent
        depth[course_id], previous[course_id] = best + 1, best_parent
        return depth[course_id]

    end = max(sorted(remaining), key=visit, default=None)
    chain = []
    while end is not None:
        chain.append(end)
        end = previous[end]
    return list(reversed(chain))


def hours(courses, ids):
    return sum(course["hours"] for course in courses if course["id"] in ids)


def summarize(courses, completed, ongoing, requirements, history):
    mandatory = [course for course in courses if course["type"] == "mandatory"]
    electives = [course for course in courses if course["type"] == "elective"]
    mandatory_ids = {course["id"] for course in mandatory}
    required_mandatory = hours(mandatory, mandatory_ids)
    profile_required = requirements.get("profile_elective_hours")
    profile_done = hours(electives, completed)
    profile_ongoing = hours(electives, ongoing - completed)
    untracked = [
        {"label": label, "hours": requirements[key]}
        for key, label in [
            ("free_elective_hours", "Eletivas livres"),
            ("complementary_hours", "Atividades complementares"),
            ("extension_hours", "Extensão"),
        ]
        if requirements.get(key)
    ]
    official = requirements.get("official_mandatory_hours")
    integralization = {
        "mandatory": {
            "required": required_mandatory,
            "completed": hours(mandatory, completed),
            "in_progress": hours(mandatory, ongoing - completed),
            "official_required": official,
        },
        "profile_electives": {
            "required": profile_required,
            "completed": profile_done,
            "in_progress": profile_ongoing,
        },
        "untracked": untracked,
        "total_hours": requirements.get("total_hours"),
        "notes": (
            [
                f"A fonte informa {official}h obrigatórias; os componentes listados somam "
                f"{required_mandatory}h."
            ]
            if official and official != required_mandatory
            else []
        ),
    }

    remaining = mandatory_ids - completed - ongoing
    chain = longest_chain(courses, remaining)
    remaining_profile = max(0, (profile_required or 0) - profile_done - profile_ongoing)
    remaining_hours = hours(mandatory, remaining) + remaining_profile
    semesters = requirements.get("standard_semesters")
    planned_load = required_mandatory + (profile_required or 0)
    pace = round(planned_load / semesters) if semesters and planned_load else None
    # Fração exata evita que o arredondamento do ritmo crie um semestre a mais.
    load_semesters = -(-remaining_hours * semesters // planned_load) if pace else None
    estimate = max(len(chain), load_semesters or 0)
    now = current_term(history.get("start_term"), history["current_period"])
    verified = all(course.get("prerequisite_status") == "verified" for course in mandatory)
    assumptions = [
        "Disciplinas em andamento são consideradas aprovadas ao fim do semestre atual.",
        "Não considera oferta de turmas, choque de horários nem reprovações futuras.",
        "Eletivas livres, atividades complementares e extensão não são acompanhadas.",
    ]
    if not verified:
        assumptions.insert(
            0,
            "Os pré-requisitos desta matriz não estão confirmados; a cadeia mínima pode ser "
            "maior do que a exibida.",
        )
    forecast = {
        "remaining_mandatory_ids": sorted(remaining),
        "remaining_mandatory_hours": hours(mandatory, remaining),
        "remaining_profile_elective_hours": remaining_profile,
        "critical_path_ids": chain,
        "critical_path_semesters": len(chain),
        "pace_hours_per_semester": pace,
        "load_semesters": load_semesters,
        "estimated_semesters": estimate,
        "current_term": now,
        "earliest_completion_term": term_after(now, len(chain)) if now and chain else now,
        "estimated_completion_term": term_after(now, estimate) if now else None,
        "prerequisites_verified": verified,
        "assumptions": assumptions,
    }
    return integralization, forecast
