"""Regras acadêmicas da UFPE usadas no acompanhamento do histórico.

Res. nº 09/2009-CCEPE/UFPE:
- art. 1º, II: 3 reprovações no mesmo componente (por nota ou falta, consecutivas ou não)
  levam à recusa de matrícula;
- art. 3º: o CR é a média ponderada das notas finais; reprovação por falta conta como
  nota final zero. O texto fala em créditos, mas o SIGAA pondera pela carga horária, e é
  com ele que o estudante compara (ver `coefficient`).
"""

FAILURE_LIMIT = 3
RULE_SOURCE = "Res. nº 09/2009-CCEPE/UFPE"


def failure_level(failures):
    """1 reprovação pede atenção, 2 são críticas e a 3ª leva à recusa de matrícula."""
    if failures >= FAILURE_LIMIT:
        return "refused"
    if failures == 2:
        return "critical"
    if failures == 1:
        return "attention"
    return None


def hour_weight(course):
    """Peso de cada componente no CR: a carga horária (CH), como faz o SIGAA da UFPE."""
    return course["hours"]


def weighted_average(entries, digits=4):
    """entries: pares (peso, nota). Devolve None quando não há nota."""
    total = sum(weight for weight, _ in entries)
    if not total:
        return None
    return round(sum(weight * grade for weight, grade in entries) / total, digits)


def coefficient(records, by_id, simulated=None):
    """CR e MC como o SIGAA da UFPE calcula.

    A Res. nº 09/2009-CCEPE fala em ponderar pelos créditos, mas o SIGAA pondera pela
    carga horária: conferido com um histórico emitido pelo SIGAA, o CR e a MC
    impressos só fecham com a CH.
    - CR: todas as tentativas com nota, inclusive reprovações (falta vale zero).
    - MC (média de conclusão): só as aprovações.
    """
    graded = [
        r
        for r in records
        if r.get("grade") is not None
        and r["status"] in {"completed", "failed"}
        and r["course_id"] in by_id
    ]
    entries = [(hour_weight(by_id[r["course_id"]]), float(r["grade"])) for r in graded]
    approved = [
        (hour_weight(by_id[r["course_id"]]), float(r["grade"]))
        for r in graded
        if r["status"] == "completed"
    ]
    simulated_entries = [
        (hour_weight(by_id[course_id]), float(grade))
        for course_id, grade in (simulated or {}).items()
        if course_id in by_id and grade is not None
    ]
    ungraded = sum(
        1 for r in records if r.get("grade") is None and r["status"] in {"completed", "failed"}
    )
    return {
        "value": weighted_average(entries),
        "mc": weighted_average(approved),
        "simulated_value": weighted_average(entries + simulated_entries)
        if simulated_entries
        else None,
        "hours": sum(weight for weight, _ in entries),
        "graded_attempts": len(entries),
        "ungraded_attempts": ungraded,
    }
