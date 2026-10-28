"""Regras acadêmicas da UFPE usadas no acompanhamento do histórico.

Res. nº 09/2009-CCEPE/UFPE:
- art. 1º, II: 3 reprovações no mesmo componente (por nota ou falta, consecutivas ou não)
  levam à recusa de matrícula;
- art. 3º: o CR é a média das notas finais ponderada pelos créditos dos componentes;
  reprovação por falta conta como nota final zero.
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


def credit_weight(course):
    # Sem crédito publicado, estima pela carga teórica (15h por crédito).
    return course.get("credits") or max(1, round(course["hours"] / 15))


def weighted_average(entries):
    """entries: pares (créditos, nota). Devolve None quando não há nota."""
    total = sum(weight for weight, _ in entries)
    if not total:
        return None
    return round(sum(weight * grade for weight, grade in entries) / total, 2)


def coefficient(records, by_id, simulated=None):
    """CR por créditos: todas as tentativas com nota entram, inclusive reprovações."""
    entries = [
        (credit_weight(by_id[r["course_id"]]), float(r["grade"]))
        for r in records
        if r.get("grade") is not None
        and r["status"] in {"completed", "failed"}
        and r["course_id"] in by_id
    ]
    simulated_entries = [
        (credit_weight(by_id[course_id]), float(grade))
        for course_id, grade in (simulated or {}).items()
        if course_id in by_id and grade is not None
    ]
    ungraded = sum(
        1 for r in records if r.get("grade") is None and r["status"] in {"completed", "failed"}
    )
    return {
        "value": weighted_average(entries),
        "simulated_value": weighted_average(entries + simulated_entries)
        if simulated_entries
        else None,
        "credits": sum(weight for weight, _ in entries),
        "graded_attempts": len(entries),
        "ungraded_attempts": ungraded,
    }
