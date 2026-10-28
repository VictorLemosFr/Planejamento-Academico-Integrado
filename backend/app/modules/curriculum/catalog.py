"""Matrizes atendidas e requisitos de integralização publicados pelo CIn.

As cargas horárias vêm da seção "Mais informações" da página oficial de cada curso.
Campos ausentes na fonte ficam como ``None``; o sistema não estima esses valores.
"""

CATALOGS = (
    {
        "id": "SI-2024",
        "program": "SI",
        "valid_from": "2024.1",
        "source_url": "https://portal.cin.ufpe.br/graduacao/sistemas-de-informacao/",
        "filename": "curriculum_si_2024.json",
        "official_mandatory_hours": 1770,
        "profile_elective_hours": 600,
        "free_elective_hours": 180,
        "complementary_hours": 150,
        "extension_hours": None,
        "total_hours": 3000,
        "standard_semesters": 8,
    },
    {
        "id": "CC-2024",
        "program": "CC",
        "valid_from": "2024.1",
        "source_url": "https://portal.cin.ufpe.br/graduacao/ciencia-da-computacao/",
        "filename": "curriculum_cc_2024.json",
        "official_mandatory_hours": 1530,
        "profile_elective_hours": 780,
        "free_elective_hours": 300,
        "complementary_hours": 270,
        "extension_hours": 320,
        "total_hours": 3200,
        "standard_semesters": 9,
    },
    {
        "id": "IA-2025",
        "program": "IA",
        "valid_from": "2025.1",
        "source_url": "https://portal.cin.ufpe.br/graduacao/inteligencia-artificial/",
        "filename": "curriculum_ia_2025.json",
        "official_mandatory_hours": 1680,
        "profile_elective_hours": 660,
        "free_elective_hours": 300,
        "complementary_hours": 240,
        "extension_hours": None,
        "total_hours": 3200,
        "standard_semesters": 9,
    },
    {
        "id": "EC-2024",
        "program": "EC",
        "valid_from": "2024.1",
        "source_url": "https://portal.cin.ufpe.br/graduacao/engenharia-da-computacao/",
        "filename": "curriculum_ec_2024.json",
        "official_mandatory_hours": 2550,
        "profile_elective_hours": 480,
        "free_elective_hours": 90,
        "complementary_hours": 120,
        "extension_hours": None,
        "total_hours": 3600,
        "standard_semesters": 10,
    },
)

REQUIREMENT_FIELDS = (
    "official_mandatory_hours",
    "profile_elective_hours",
    "free_elective_hours",
    "complementary_hours",
    "extension_hours",
    "total_hours",
    "standard_semesters",
)

PROGRAM_NAMES = {
    "CC": "Ciência da Computação",
    "SI": "Sistemas de Informação",
    "IA": "Inteligência Artificial",
    "EC": "Engenharia da Computação",
}
