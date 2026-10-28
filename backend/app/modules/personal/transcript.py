"""Leitura do PDF do histórico escolar emitido pelo SIGAA.

O arquivo é processado em memória e descartado: nada do PDF é gravado. O resultado é
uma proposta de registros que o estudante revisa antes de salvar o histórico.

A leitura não depende da posição exata das colunas. Em cada linha procuramos:
- um código conhecido da matriz do estudante (por exemplo, CIN0133);
- um semestre no formato AAAA.1 ou AAAA.2 (o último visto vale para linhas seguintes,
  pois alguns layouts mostram o semestre apenas na primeira linha do grupo);
- uma situação do SIGAA (APR, REP, REPF, MATR...).
"""

import re
import unicodedata
from io import BytesIO

MAX_BYTES = 5 * 1024 * 1024
MAX_PAGES = 40

# Siglas curtas demais (AP, RF...) ficam de fora para não confundir com palavras do nome.
COMPLETED = {
    "APR", "APRN", "APROVADO", "APROVADA", "APROVADO POR NOTA", "DISP", "DISPENSADO",
    "DISPENSADA", "CUMP", "CUMPRIU", "INCORP", "INCORPORADO", "APROV", "APROVEITAMENTO",
}  # fmt: skip
FAILED = {
    "REP", "REPF", "REPN", "REPNF", "REPMF", "REPROVADO", "REPROVADA", "REPROVADO POR FALTA",
    "REPROVADO POR NOTA", "REPROVADO POR MEDIA",
}  # fmt: skip
IN_PROGRESS = {"MATR", "MATRICULADO", "MATRICULADA", "CURSANDO", "EM CURSO", "EM ANDAMENTO"}
IGNORED = {"TRANC", "TRANCADO", "TRANCADA", "CANC", "CANCELADO", "CANCELADA", "TRANS", "INDEF"}

TERM = re.compile(r"\b(20\d{2})\s*[./-]\s*([12])\b")
CODE = re.compile(r"\b([A-Z]{2,4})\s?(\d{3,4})\b")
STATUS_WORDS = sorted(COMPLETED | FAILED | IN_PROGRESS | IGNORED, key=len, reverse=True)
STATUS = re.compile(r"(?<![A-Z])(" + "|".join(map(re.escape, STATUS_WORDS)) + r")(?![A-Z])")


class TranscriptError(ValueError):
    pass


def plain(text):
    """Maiúsculas sem acentos, para comparar situações e nomes de forma tolerante."""
    decomposed = unicodedata.normalize("NFKD", text.replace("\xa0", " "))
    return "".join(ch for ch in decomposed if not unicodedata.combining(ch)).upper()


def classify(word):
    if word in COMPLETED:
        return "completed"
    if word in FAILED:
        return "failed"
    if word in IN_PROGRESS:
        return "in_progress"
    return None


def extract_text(data: bytes) -> str:
    from pypdf import PdfReader
    from pypdf.errors import PdfReadError

    if len(data) > MAX_BYTES:
        raise TranscriptError("O PDF excede 5 MB.")
    if not data.startswith(b"%PDF"):
        raise TranscriptError("Envie o histórico em PDF.")
    try:
        reader = PdfReader(BytesIO(data))
        if reader.is_encrypted:
            raise TranscriptError("O PDF está protegido por senha.")
        if len(reader.pages) > MAX_PAGES:
            raise TranscriptError("O PDF tem páginas demais para um histórico.")
        pages = []
        for page in reader.pages:
            try:
                pages.append(page.extract_text(extraction_mode="layout"))
            except Exception:  # noqa: BLE001 - alguns PDFs só aceitam a extração simples
                pages.append(page.extract_text())
    except PdfReadError as error:
        raise TranscriptError("Não foi possível ler o PDF.") from error
    return "\n".join(pages)


def candidates_by_code(courses):
    found = {}
    for course in courses:
        if course.get("source_code"):
            code = re.sub(r"\s", "", course["source_code"].upper())
            found.setdefault(code, []).append(course)
    return found


def choose(options, context):
    """Desempata códigos repetidos na matriz pela semelhança do nome com a linha."""
    if len(options) == 1:
        return options[0]
    words = set(re.findall(r"[A-Z]{4,}", plain(context)))
    scored = sorted(
        options,
        key=lambda c: len(words & set(re.findall(r"[A-Z]{4,}", plain(c["name"])))),
        reverse=True,
    )
    first, second = (
        len(words & set(re.findall(r"[A-Z]{4,}", plain(c["name"])))) for c in scored[:2]
    )
    return scored[0] if first > second else None


GRADE = re.compile(r"(?<![\d,.])(\d{1,2})[,.](\d{1,2})(?![\d,.])")
ABSENCE = {"REPF", "REPMF", "REPNF", "REPROVADO POR FALTA"}


def final_grade(context, word):
    """Nota final: o último decimal entre 0 e 10 antes da situação (a frequência passa de 10).

    Reprovação por falta vale zero no CR (Res. nº 09/2009-CCEPE, art. 3º).
    """
    if word in ABSENCE:
        return 0.0
    before = context[: context.rfind(word)] if word else context
    grades = [float(f"{a}.{b}") for a, b in GRADE.findall(before)]
    grades = [grade for grade in grades if 0 <= grade <= 10]
    return grades[-1] if grades else None


def parse_transcript(text, courses):
    """Converte o texto do histórico em registros da matriz e pendências para revisão."""
    known = candidates_by_code(courses)
    lines = [plain(line) for line in text.splitlines()]
    records, unmatched, ignored = {}, [], []
    last_term = None
    for index, line in enumerate(lines):
        terms = list(TERM.finditer(line))
        codes = list(CODE.finditer(line))
        if not codes:
            if terms:
                last_term = f"{terms[-1].group(1)}.{terms[-1].group(2)}"
            continue
        for position, match in enumerate(codes):
            code = match.group(1) + match.group(2)
            end = codes[position + 1].start() if position + 1 < len(codes) else len(line)
            before = [t for t in terms if t.start() < match.start()]
            term = f"{before[-1].group(1)}.{before[-1].group(2)}" if before else last_term
            segment = line[match.end() : end]
            status = STATUS.findall(segment)
            context = segment
            # Nomes longos podem quebrar a linha; a situação aparece logo abaixo.
            lookahead = 1
            while not status and lookahead <= 2 and index + lookahead < len(lines):
                following = lines[index + lookahead]
                if CODE.search(following):
                    break
                status = STATUS.findall(following)
                context = following
                lookahead += 1
            word = status[-1] if status else None
            kind = classify(word) if word else None
            entry = {"code": code, "academic_term": term, "status_text": word}
            if code not in known:
                if term and word:
                    unmatched.append({**entry, "reason": "Código fora da matriz do curso."})
                continue
            if not term or not word:
                unmatched.append({**entry, "reason": "Semestre ou situação não identificados."})
                continue
            if kind is None:
                ignored.append({**entry, "reason": "Situação sem efeito no planejamento."})
                continue
            course = choose(known[code], segment)
            if course is None:
                unmatched.append({**entry, "reason": "Código repetido na matriz; escolha manual."})
                continue
            records[(course["id"], term)] = {
                "course_id": course["id"],
                "academic_term": term,
                "status": kind,
                "grade": None if kind == "in_progress" else final_grade(context, word),
                "code": code,
                "name": course["name"],
            }
        if terms:
            last_term = f"{terms[-1].group(1)}.{terms[-1].group(2)}"
    ordered = sorted(records.values(), key=lambda r: (r["academic_term"], r["code"]))
    return {
        "records": ordered,
        "unmatched": unmatched,
        "ignored": ignored,
        "start_term": ordered[0]["academic_term"] if ordered else None,
    }
