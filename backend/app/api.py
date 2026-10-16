import json
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_session
from app.modules.curriculum.repository import list_courses
from app.modules.planning.schemas import (
    CourseView,
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
