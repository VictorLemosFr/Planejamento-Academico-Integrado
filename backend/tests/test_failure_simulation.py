"""Reprovação simulada: reprovar o que está em andamento e replanejar a trajetória."""

from test_academic_rules import attempts, signup


def save_history(client, headers, period, records, term="2024.1"):
    response = client.put(
        "/api/me/history",
        headers=headers,
        json={"start_term": term, "current_period": period, "records": records},
    )
    assert response.status_code == 200, response.text


def new_plan(client, headers, name="Se eu reprovar"):
    response = client.post(
        "/api/plans", headers=headers, json={"name": name, "target_term": "2024.2"}
    )
    assert response.status_code == 201, response.text
    return response.json()


def evaluate(client, headers, plan, **draft):
    body = {
        "version": plan["version"],
        "history_revision": plan["history_revision"],
        "planned_ids": plan["planned_ids"],
        "hypothetical_ids": plan["hypothetical_ids"],
        "course_layout": plan["course_layout"],
        "simulated_grades": plan.get("simulated_grades", {}),
        "simulated_failures": plan.get("simulated_failures", {}),
        **draft,
    }
    return client.post(f"/api/plans/{plan['id']}/simulations", headers=headers, json=body)


def by_id(view):
    return {course["id"]: course for course in view["courses"]}


def planned_draft():
    """1º período cursando IP; o plano já põe as dependentes nos semestres seguintes."""
    return {
        "planned_ids": ["algo", "bd", "ds", "edoo"],
        "course_layout": {
            "edoo": {"period": 2, "order": 0},
            "ds": {"period": 2, "order": 1},
            "algo": {"period": 3, "order": 0},
            "bd": {"period": 3, "order": 1},
        },
    }


def test_failing_in_progress_course_replans_it_and_pushes_dependents(client):
    headers = signup(client, period=1)
    save_history(
        client,
        headers,
        1,
        attempts(("ip", "2024.1", "in_progress", None), ("mdc", "2024.1", "in_progress", None)),
    )
    plan = new_plan(client, headers)
    before = evaluate(client, headers, plan, **planned_draft())
    assert before.status_code == 200, before.text
    before = before.json()
    assert before["valid"], before["problems"]

    response = evaluate(
        client, headers, {**plan, **before}, action={"kind": "fail", "course_id": "ip"}
    )
    assert response.status_code == 200, response.text
    after = response.json()
    courses = by_id(after)

    # IP volta a ser cursada no próximo semestre, como reprovação simulada.
    assert after["simulated_failures"] == {"ip": None}
    assert courses["ip"]["simulated_failure"] and courses["ip"]["status"] == "planned"
    assert courses["ip"]["failures"] == 1 and courses["ip"]["failure_level"] == "attention"
    assert after["course_layout"]["ip"]["period"] == 2
    assert "ip" not in after["in_progress_ids"] and "mdc" in after["in_progress_ids"]
    # Tudo o que dependia dela foi adiado um semestre, em cascata.
    assert after["rescheduled_ids"] == ["algo", "bd", "ds", "edoo"]
    assert {cid: after["course_layout"][cid]["period"] for cid in after["rescheduled_ids"]} == {
        "edoo": 3,
        "ds": 3,
        "algo": 4,
        "bd": 4,
    }
    assert after["valid"], after["problems"]
    # O histórico informado continua intocado.
    assert by_id(client.get("/api/me/progression").json())["ip"]["status"] == "in_progress"

    # A previsão do plano é a mesma do "E se eu reprovar?".
    impact = client.get("/api/me/progression/failure-impact/ip").json()
    assert (
        after["forecast"]["estimated_completion_term"]
        == (impact["after"]["estimated_completion_term"])
    )
    assert after["forecast"]["estimated_semesters"] > before["forecast"]["estimated_semesters"]


def test_simulated_failure_is_saved_enters_simulated_cr_and_can_be_undone(client):
    headers = signup(client, period=2)
    save_history(
        client,
        headers,
        2,
        attempts(
            ("ip", "2024.1", "completed", 8.0),
            ("edoo", "2024.2", "in_progress", None),
        ),
    )
    plan = new_plan(client, headers)
    failed = evaluate(client, headers, plan, action={"kind": "fail", "course_id": "edoo"})
    assert failed.status_code == 200, failed.text
    draft = {**plan, **failed.json(), "simulated_failures": {"edoo": 3.0}}

    saved = client.put(
        f"/api/plans/{plan['id']}",
        headers=headers,
        json={
            "name": draft["name"],
            "target_term": draft["target_term"],
            "version": draft["version"],
            "history_revision": draft["history_revision"],
            "planned_ids": draft["planned_ids"],
            "hypothetical_ids": draft["hypothetical_ids"],
            "course_layout": draft["course_layout"],
            "simulated_grades": {"edoo": 7.0},
            "simulated_failures": draft["simulated_failures"],
        },
    )
    assert saved.status_code == 200, saved.text
    reloaded = client.get(f"/api/plans/{plan['id']}").json()
    assert reloaded["simulated_failures"] == {"edoo": 3.0}
    assert by_id(reloaded)["edoo"]["simulated_failure"]
    # CR simulado: IP 8,0 (120h) + reprovação 3,0 (60h) + refazer com 7,0 (60h).
    assert reloaded["cr"]["value"] == 8.0
    assert reloaded["cr"]["simulated_value"] == round((120 * 8 + 60 * 3 + 60 * 7) / 240, 4)

    undone = evaluate(client, headers, reloaded, action={"kind": "unfail", "course_id": "edoo"})
    assert undone.status_code == 200, undone.text
    undone = undone.json()
    assert undone["simulated_failures"] == {}
    assert by_id(undone)["edoo"]["status"] == "in_progress"
    assert "edoo" not in undone["planned_ids"] and "edoo" not in undone["course_layout"]
    assert undone["valid"]


def test_only_in_progress_courses_can_fail_in_a_plan(client):
    headers = signup(client, period=2)
    save_history(client, headers, 2, attempts(("ip", "2024.1", "completed", 8.0)))
    plan = new_plan(client, headers)
    for course_id in ["ip", "edoo", "nada"]:
        response = evaluate(client, headers, plan, action={"kind": "fail", "course_id": course_id})
        assert response.status_code == 422


def test_third_simulated_failure_is_refused_and_not_replanned(client):
    headers = signup(client, period=3)
    save_history(
        client,
        headers,
        3,
        attempts(
            ("ip", "2024.1", "failed", 2.0),
            ("ip", "2024.2", "failed", 3.0),
            ("ip", "2025.1", "in_progress", None),
        ),
    )
    plan = new_plan(client, headers)
    response = evaluate(client, headers, plan, action={"kind": "fail", "course_id": "ip"})
    assert response.status_code == 200, response.text
    body = response.json()
    ip = by_id(body)["ip"]
    assert ip["failures"] == 3 and ip["failure_level"] == "refused"
    assert "ip" not in body["planned_ids"]
    assert any("recusada" in warning for warning in body["warnings"])
    # O cenário pode ser guardado; planejar a disciplina recusada é que não pode.
    assert body["valid"]
    planned = evaluate(
        client, headers, {**plan, **body}, action={"kind": "plan", "course_id": "ip"}
    )
    assert planned.status_code == 422


def test_history_update_flags_stale_simulated_failure(client):
    headers = signup(client, period=1)
    save_history(client, headers, 1, attempts(("ip", "2024.1", "in_progress", None)))
    plan = new_plan(client, headers)
    failed = {
        **plan,
        **evaluate(client, headers, plan, action={"kind": "fail", "course_id": "ip"}).json(),
    }
    saved = client.put(
        f"/api/plans/{plan['id']}",
        headers=headers,
        json={
            key: failed[key]
            for key in [
                "name",
                "target_term",
                "version",
                "history_revision",
                "planned_ids",
                "hypothetical_ids",
                "course_layout",
                "simulated_failures",
            ]
        },
    )
    assert saved.status_code == 200, saved.text
    # O semestre acabou e o estudante foi aprovado: a reprovação simulada perde o sentido.
    save_history(client, headers, 2, attempts(("ip", "2024.1", "completed", 9.0)))
    stale = client.get(f"/api/plans/{plan['id']}").json()
    assert not stale["valid"]
    assert any("andamento" in issue for issue in stale["problems"]["ip"])


def test_shared_link_hides_simulated_failures(client):
    headers = signup(client, period=1)
    save_history(client, headers, 1, attempts(("ip", "2024.1", "in_progress", None)))
    plan = new_plan(client, headers)
    failed = {
        **plan,
        **evaluate(client, headers, plan, action={"kind": "fail", "course_id": "ip"}).json(),
    }
    client.put(
        f"/api/plans/{plan['id']}",
        headers=headers,
        json={
            key: failed[key]
            for key in [
                "name",
                "target_term",
                "version",
                "history_revision",
                "planned_ids",
                "hypothetical_ids",
                "course_layout",
                "simulated_failures",
            ]
        },
    )
    token = client.post(f"/api/plans/{plan['id']}/share", headers=headers).json()["token"]
    text = client.get(f"/api/public/shared/{token}").text
    assert "simulated_failure" not in text and "rescheduled_ids" not in text
