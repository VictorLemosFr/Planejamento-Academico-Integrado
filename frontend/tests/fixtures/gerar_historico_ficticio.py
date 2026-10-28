"""Gera o PDF fictício usado no teste de importação; nenhum dado é real.

Uso (na pasta backend): uv run python ../frontend/tests/fixtures/gerar_historico_ficticio.py
"""

from pathlib import Path

from fpdf import FPDF

LINES = [
    "UNIVERSIDADE FEDERAL DE PERNAMBUCO - HISTORICO ESCOLAR (DOCUMENTO FICTICIO)",
    "Ano/Periodo  Componente Curricular                          CH   Turma  Nota  Situacao",
    "2025.1       CIN0133 - INTRODUCAO A PROGRAMACAO             60   01     9,5   APR",
    "             CIN0132 - MATEMATICA DISCRETA PARA COMPUTACAO  60   01     8,0   APR",
    "2025.1       CIN0130 - SISTEMAS DIGITAIS                    60   01     3,0   REP",
    "2025.2       CIN0135 - ESTRUTURA DE DADOS ORIENTADAS A",
    "             OBJETOS                                        60   01     --    MATR",
    "2025.2       IF9999 - DISCIPLINA DE OUTRO CENTRO            60   01     7,0   APR",
]

pdf = FPDF()
pdf.add_page()
pdf.set_font("Courier", size=7)
for line in LINES:
    pdf.cell(0, 5, line, new_x="LMARGIN", new_y="NEXT")
pdf.output(str(Path(__file__).with_name("historico-ficticio.pdf")))
