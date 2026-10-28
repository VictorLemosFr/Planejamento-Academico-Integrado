"""Leitura do histórico em PDF com dados fictícios, nunca com históricos reais."""

from fpdf import FPDF

from app.modules.personal.transcript import TranscriptError, extract_text, parse_transcript

ORIGIN = {"Origin": "http://testserver"}

COURSES = [
    {"id": "cc:cin0133", "source_code": "CIN0133", "name": "INTRODUÇÃO À PROGRAMAÇÃO"},
    {"id": "cc:cin0131", "source_code": "CIN0131", "name": "CONCEPÇÃO DE ARTEFATOS DIGITAIS"},
    {"id": "cc:ma026", "source_code": "MA026", "name": "CÁLCULO DIFERENCIAL E INTEGRAL 1"},
    {"id": "cc:cin0135", "source_code": "CIN0135", "name": "ESTRUTURAS DE DADOS ORIENTADAS"},
    {"id": "cc:cin0130", "source_code": "CIN0130", "name": "SISTEMAS DIGITAIS"},
    {"id": "ia:a", "source_code": "CIN0123", "name": "MATEMÁTICA DISCRETA PARA COMPUTAÇÃO"},
    {"id": "ia:b", "source_code": "CIN0123", "name": "PROBABILIDADE E ESTATÍSTICA"},
]

FICTIONAL = """UNIVERSIDADE FEDERAL DE PERNAMBUCO - HISTÓRICO ESCOLAR (FICTÍCIO)
Ano/Período  Componente Curricular                         CH   Turma  Freq   Nota  Situação
2025.1       CIN0133 - INTRODUÇÃO À PROGRAMAÇÃO            60   01     100,0  9,5   APR
             CIN0131 - CONCEPÇÃO DE ARTEFATOS DIGITAIS     120  01     95,0   8,0   APROVADO
2025.1       MA026 - CÁLCULO DIFERENCIAL E INTEGRAL 1      60   02     70,0   2,0   REPF
2025.2       MA026 - CÁLCULO DIFERENCIAL E INTEGRAL 1      60   03     --     --    MATR
2025.2       CIN0135 - ESTRUTURAS DE DADOS ORIENTADAS A
             OBJETOS                                       60   01     --     --    MATR
2025.2       CIN0130 - SISTEMAS DIGITAIS                   60   01     --     --    TRANC
2025.2       IF9999 - DISCIPLINA DE OUTRO CENTRO           60   01     90,0   7,0   APR
2025.2       CIN0123 - PROBABILIDADE E ESTATÍSTICA         60   01     90,0   7,5   APR
"""


def test_parser_reads_terms_statuses_and_wrapped_names():
    result = parse_transcript(FICTIONAL, COURSES)
    found = {(r["course_id"], r["academic_term"]): r["status"] for r in result["records"]}
    assert found == {
        ("cc:cin0133", "2025.1"): "completed",
        ("cc:cin0131", "2025.1"): "completed",
        ("cc:ma026", "2025.1"): "failed",
        ("cc:ma026", "2025.2"): "in_progress",
        ("cc:cin0135", "2025.2"): "in_progress",
        ("ia:b", "2025.2"): "completed",
    }
    assert result["start_term"] == "2025.1"
    assert [item["code"] for item in result["unmatched"]] == ["IF9999"]
    assert [item["code"] for item in result["ignored"]] == ["CIN0130"]


def test_ambiguous_code_without_name_is_left_for_review():
    result = parse_transcript("2025.1 CIN0123 60 01 APR", COURSES)
    assert result["records"] == []
    assert result["unmatched"][0]["reason"].startswith("Código repetido")


def fictional_pdf():
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", size=8)
    for line in FICTIONAL.splitlines():
        pdf.cell(0, 5, line, new_x="LMARGIN", new_y="NEXT")
    return bytes(pdf.output())


def test_pdf_roundtrip_and_rejections():
    text = extract_text(fictional_pdf())
    assert len(parse_transcript(text, COURSES)["records"]) == 6
    for data in [b"not a pdf", b"%PDF" + b"0" * (5 * 1024 * 1024)]:
        try:
            extract_text(data)
        except TranscriptError:
            continue
        raise AssertionError("PDF inválido aceito")


def test_endpoint_returns_a_proposal_without_saving(client):
    from app.core.database import get_session
    from app.main import app
    from app.seed import seed

    with next(app.dependency_overrides[get_session]()) as session:
        seed(session)
    signup = client.post(
        "/api/auth/register",
        headers=ORIGIN,
        json={
            "email": "pdf@example.org",
            "password": "long-secret",
            "registration": "PDF1",
            "current_period": 2,
            "start_term": "2025.1",
            "program": "CC",
        },
    )
    headers = {**ORIGIN, "X-CSRF-Token": signup.json()["csrf_token"]}
    response = client.post(
        "/api/me/history/pdf",
        headers={**headers, "Content-Type": "application/pdf"},
        content=fictional_pdf(),
    )
    assert response.status_code == 200, response.text
    assert {r["course_id"] for r in response.json()["records"]} >= {"cc:cin0133", "cc:ma026"}
    assert client.get("/api/me/history").json()["revision"] == 0
    assert (
        client.post(
            "/api/me/history/pdf",
            headers={**headers, "Content-Type": "text/plain"},
            content=b"x",
        ).status_code
        == 415
    )
    assert (
        client.post(
            "/api/me/history/pdf",
            headers={**ORIGIN, "Content-Type": "application/pdf"},
            content=fictional_pdf(),
        ).status_code
        == 403
    )
