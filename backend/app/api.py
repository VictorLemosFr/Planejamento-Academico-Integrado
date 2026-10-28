import json
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_session
from app.modules.curriculum.models import Curriculum
from app.modules.curriculum.repository import list_courses, requirements_view
from app.modules.personal.service import evaluate
from app.modules.planning.schemas import (
    CourseView,
    PublicEvaluation,
    Scenario,
    SimulationRequest,
    SimulationResponse,
)
from app.modules.planning.service import simulate

router = APIRouter(prefix="/api")
Database = Annotated[Session, Depends(get_session)]


@router.get("/health", tags=["Operação"])
def health(session: Database):
    session.execute(text("SELECT 1"))
    return {"status": "ok"}


@router.get("/curriculum", response_model=list[CourseView], tags=["Grade curricular"])
def curriculum(session: Database):
    return list_courses(session)


@router.get("/scenarios", response_model=list[Scenario], tags=["Demonstração"])
def scenarios():
    if not get_settings().demo_enabled:
        raise HTTPException(404, "Demonstração desativada.")
    return json.loads((Path(__file__).parent / "data" / "scenarios.json").read_text())


@router.post("/simulations", response_model=SimulationResponse, tags=["Planejamento"])
def simulation(payload: SimulationRequest, session: Database):
    if not get_settings().demo_enabled:
        raise HTTPException(404, "Demonstração desativada.")
    courses = list_courses(session)
    if not courses:
        raise HTTPException(503, "A grade está vazia. Carregue os dados de demonstração no banco.")
    try:
        return simulate(courses, **payload.model_dump())
    except ValueError as error:
        raise HTTPException(422, str(error)) from error


@router.get("/public/curricula", tags=["Grade pública"])
def public_curricula(session: Database):
    """Matrizes disponíveis para navegação sem conta."""
    result = []
    for curriculum in session.scalars(select(Curriculum).order_by(Curriculum.program)):
        courses = list_courses(session, curriculum.id)
        result.append(
            {
                **requirements_view(curriculum),
                "course_count": len(courses),
                "mandatory_count": sum(course["type"] == "mandatory" for course in courses),
                "prerequisites_verified": bool(courses)
                and all(course["prerequisite_status"] == "verified" for course in courses),
                "unverified_count": sum(
                    course["prerequisite_status"] == "unverified" for course in courses
                ),
            }
        )
    return result


def public_evaluation(session, curriculum_id, payload):
    curriculum = session.get(Curriculum, curriculum_id)
    if curriculum is None:
        raise HTTPException(404, "Matriz não encontrada.")
    courses = list_courses(session, curriculum.id)
    history = {
        "revision": 0,
        "awaiting_import": True,
        "current_period": payload.current_period,
        "start_term": payload.start_term,
        "records": [],
    }
    action = (
        {"kind": payload.action, "course_id": payload.course_id}
        if payload.action and payload.course_id
        else None
    )
    try:
        result = evaluate(
            courses,
            history,
            payload.hypothetical_ids,
            action=action,
            requirements=requirements_view(curriculum),
        )
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
    return {"curriculum": requirements_view(curriculum), **result}


@router.get("/public/curricula/{curriculum_id}", tags=["Grade pública"])
def public_curriculum(curriculum_id: str, session: Database):
    return public_evaluation(session, curriculum_id, PublicEvaluation())


@router.post("/public/curricula/{curriculum_id}/simulations", tags=["Grade pública"])
def public_simulation(curriculum_id: str, payload: PublicEvaluation, session: Database):
    return public_evaluation(session, curriculum_id, payload)
