from datetime import UTC, datetime, timedelta
from secrets import token_urlsafe

from fastapi import APIRouter, HTTPException, Query, Request, Response
from sqlalchemy import delete, select

from app.core.config import get_settings
from app.modules.curriculum.repository import list_courses
from app.modules.personal.models import LoginSession, Plan, Student, User, now
from app.modules.personal.schemas import EvaluateDraft, HistoryPayload, Login, NewPlan, SavePlan
from app.modules.personal.security import (
    COOKIE,
    DUMMY_HASH,
    Database,
    Identity,
    passwords,
    require_origin,
    token_hash,
)
from app.modules.personal.service import evaluate, history_view, import_history, plan_view

router = APIRouter(prefix="/api", tags=["Identidade, histórico e planos"])


def user_view(user, login):
    return {
        "user": {"id": user.id, "email": user.email, "role": user.role},
        "csrf_token": login.csrf_token,
    }


def student_for(session, user):
    student = session.scalar(select(Student).where(Student.user_id == user.id).with_for_update())
    if student is None:
        raise HTTPException(403, "Esta conta não possui perfil de estudante.")
    return student


def own_plan(session, student, plan_id):
    plan = session.scalar(
        select(Plan).where(Plan.id == plan_id, Plan.student_id == student.id).with_for_update()
    )
    if plan is None:
        raise HTTPException(404, "Plano não encontrado.")
    return plan


def require_version(plan, student, version, revision=None):
    if plan.version != version or (revision is not None and student.history_revision != revision):
        raise HTTPException(
            409,
            "O plano ou histórico mudou. Recarregue antes de salvar; seu rascunho não foi gravado.",
        )


@router.post("/auth/login")
def login(payload: Login, request: Request, response: Response, session: Database):
    require_origin(request)
    user = session.scalar(
        select(User).where(User.email == payload.email.strip().lower()).with_for_update()
    )
    valid = passwords.verify(payload.password, user.password_hash if user else DUMMY_HASH)
    if not valid or user is None or not user.active:
        raise HTTPException(401, "E-mail ou senha inválidos.")
    # Rotate any existing session in this browser, including a different account.
    session.execute(
        delete(LoginSession).where(
            LoginSession.token_hash == token_hash(request.cookies.get(COOKIE, ""))
        )
    )
    token = token_urlsafe(32)
    login_session = LoginSession(
        token_hash=token_hash(token),
        user_id=user.id,
        csrf_token=token_urlsafe(32),
        expires_at=datetime.now(UTC) + timedelta(hours=8),
    )
    session.add(login_session)
    session.commit()
    response.set_cookie(
        COOKIE,
        token,
        max_age=8 * 60 * 60,
        httponly=True,
        samesite="lax",
        secure=get_settings().environment == "production",
        path="/",
    )
    response.headers["Cache-Control"] = "no-store"
    return user_view(user, login_session)


@router.get("/auth/me")
def me(identity: Identity, response: Response):
    response.headers["Cache-Control"] = "no-store"
    return user_view(*identity)


@router.post("/auth/logout")
def logout(identity: Identity, session: Database, response: Response):
    session.delete(identity[1])
    session.commit()
    response.delete_cookie(
        COOKIE,
        path="/",
        httponly=True,
        samesite="lax",
        secure=get_settings().environment == "production",
    )
    return {"status": "ok"}


@router.get("/me/history")
def history(identity: Identity, session: Database):
    return history_view(session, student_for(session, identity[0]))


@router.get("/me/progression")
def progression(identity: Identity, session: Database):
    return evaluate(list_courses(session), history_view(session, student_for(session, identity[0])))


@router.put("/admin/students/{registration}/history")
def upload_history(
    registration: str, payload: HistoryPayload, identity: Identity, session: Database
):
    if identity[0].role != "coordination":
        raise HTTPException(403, "A importação exige conta da coordenação.")
    student = session.scalar(
        select(Student).where(Student.registration == registration).with_for_update()
    )
    if student is None:
        raise HTTPException(404, "Matrícula não provisionada.")
    return import_history(session, student, identity[0], payload, list_courses(session))


@router.get("/plans")
def plans(identity: Identity, session: Database):
    student = student_for(session, identity[0])
    courses = list_courses(session)
    return [
        plan_view(session, student, plan, courses)
        for plan in session.scalars(
            select(Plan).where(Plan.student_id == student.id).order_by(Plan.created_at)
        )
    ]


@router.post("/plans", status_code=201)
def create_plan(payload: NewPlan, identity: Identity, session: Database):
    student = student_for(session, identity[0])
    plan = Plan(student_id=student.id, **payload.model_dump())
    session.add(plan)
    session.flush()
    result = plan_view(session, student, plan, list_courses(session))
    session.commit()
    return result


@router.get("/plans/{plan_id}")
def get_plan(plan_id: str, identity: Identity, session: Database):
    student = student_for(session, identity[0])
    return plan_view(session, student, own_plan(session, student, plan_id), list_courses(session))


@router.post("/plans/{plan_id}/simulations")
def simulation(plan_id: str, payload: EvaluateDraft, identity: Identity, session: Database):
    student = student_for(session, identity[0])
    plan = own_plan(session, student, plan_id)
    require_version(plan, student, payload.version, payload.history_revision)
    try:
        return evaluate(
            list_courses(session),
            history_view(session, student),
            payload.hypothetical_ids,
            payload.planned_ids,
            payload.action.model_dump() if payload.action else None,
        )
    except ValueError as error:
        raise HTTPException(422, str(error)) from error


@router.put("/plans/{plan_id}")
def save_plan(plan_id: str, payload: SavePlan, identity: Identity, session: Database):
    student = student_for(session, identity[0])
    plan = own_plan(session, student, plan_id)
    require_version(plan, student, payload.version, payload.history_revision)
    courses = list_courses(session)
    try:
        evaluated = evaluate(
            courses, history_view(session, student), payload.hypothetical_ids, payload.planned_ids
        )
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
    if not evaluated["valid"]:
        raise HTTPException(422, evaluated["problems"])
    plan.name, plan.target_term = payload.name, payload.target_term
    plan.hypothetical_ids, plan.planned_ids = (
        evaluated["hypothetical_ids"],
        evaluated["planned_ids"],
    )
    plan.version += 1
    plan.updated_at = now()
    result = plan_view(session, student, plan, courses)
    session.commit()
    return result


@router.delete("/plans/{plan_id}")
def delete_plan(plan_id: str, identity: Identity, session: Database, version: int = Query(ge=1)):
    student = student_for(session, identity[0])
    plan = own_plan(session, student, plan_id)
    require_version(plan, student, version)
    session.delete(plan)
    session.commit()
    return {"status": "deleted"}
