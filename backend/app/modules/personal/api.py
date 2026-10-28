from datetime import UTC, datetime, timedelta
from secrets import token_urlsafe

from fastapi import APIRouter, HTTPException, Query, Request, Response
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError

from app.core.config import get_settings
from app.modules.constraints.service import CurriculumGraph
from app.modules.curriculum.models import Curriculum
from app.modules.curriculum.repository import list_courses, requirements_view
from app.modules.personal.models import LoginSession, Plan, Student, User, now
from app.modules.personal.schemas import (
    EvaluateDraft,
    HistoryPayload,
    Login,
    NewPlan,
    Register,
    SavePlan,
    SelfHistoryPayload,
)
from app.modules.personal.security import (
    COOKIE,
    DUMMY_HASH,
    Database,
    Identity,
    passwords,
    require_origin,
    token_hash,
)
from app.modules.personal.service import (
    evaluate,
    failure_impact_view,
    history_view,
    import_history,
    plan_view,
    shared_view,
    validate_records,
)
from app.modules.personal.transcript import (
    MAX_BYTES,
    TranscriptError,
    extract_text,
    parse_transcript,
)

router = APIRouter(prefix="/api", tags=["Identidade, histórico e planos"])


def user_view(session, user, login):
    student = session.scalar(select(Student).where(Student.user_id == user.id))
    return {
        "user": {"id": user.id, "email": user.email, "role": user.role},
        "student": {
            "program": student.program,
            "curriculum": curriculum_view(session, student),
        }
        if student
        else None,
        "csrf_token": login.csrf_token,
    }


def student_curriculum(session, student, start_term=None):
    term = start_term or student.start_term
    program = select(Curriculum).where(Curriculum.program == student.program)
    if term is None:
        if student.program != "SI":
            return None
        # Contas legadas de SI, provisionadas sem ingresso, mantêm a matriz de SI.
        return session.scalar(program.order_by(Curriculum.valid_from))
    return session.scalar(
        program.where(Curriculum.valid_from <= term).order_by(Curriculum.valid_from.desc())
    )


def curriculum_view(session, student):
    curriculum = student_curriculum(session, student)
    if curriculum:
        return {
            "available": True,
            "id": curriculum.id,
            "valid_from": curriculum.valid_from,
            "source_url": curriculum.source_url,
        }
    earliest = session.scalar(
        select(Curriculum)
        .where(Curriculum.program == student.program)
        .order_by(Curriculum.valid_from)
    )
    return {
        "available": False,
        "id": None,
        "valid_from": earliest.valid_from if earliest else None,
        "source_url": None,
    }


def student_for(session, user, require_curriculum=True):
    student = session.scalar(select(Student).where(Student.user_id == user.id).with_for_update())
    if student is None:
        raise HTTPException(403, "Esta conta não possui perfil de estudante.")
    if require_curriculum and student_curriculum(session, student) is None:
        raise HTTPException(409, "Não há matriz curricular para este curso e semestre de ingresso.")
    return student


def courses_for(session, student):
    curriculum = student_curriculum(session, student)
    if curriculum is None:
        raise HTTPException(409, "Não há matriz curricular para este curso e semestre de ingresso.")
    return list_courses(session, curriculum.id)


def requirements_for(session, student):
    return requirements_view(student_curriculum(session, student))


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


def start_session(session, user, request, response):
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
    return user_view(session, user, login_session)


@router.post("/auth/register", status_code=201)
def register(payload: Register, request: Request, response: Response, session: Database):
    require_origin(request)
    user = User(
        email=payload.email,
        password_hash=passwords.hash(payload.password),
        role="student",
    )
    session.add(user)
    try:
        session.flush()
        session.add(
            Student(
                user_id=user.id,
                registration=payload.registration,
                current_period=payload.current_period,
                start_term=payload.start_term,
                program=payload.program,
                coordination_managed=False,
            )
        )
        session.flush()
    except IntegrityError as error:
        session.rollback()
        raise HTTPException(409, "E-mail ou matrícula já cadastrados.") from error
    return start_session(session, user, request, response)


@router.post("/auth/login")
def login(payload: Login, request: Request, response: Response, session: Database):
    require_origin(request)
    user = session.scalar(
        select(User).where(User.email == payload.email.strip().lower()).with_for_update()
    )
    valid = passwords.verify(payload.password, user.password_hash if user else DUMMY_HASH)
    if not valid or user is None or not user.active:
        raise HTTPException(401, "E-mail ou senha inválidos.")
    return start_session(session, user, request, response)


@router.get("/auth/me")
def me(identity: Identity, response: Response, session: Database):
    response.headers["Cache-Control"] = "no-store"
    return user_view(session, *identity)


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
    return history_view(session, student_for(session, identity[0], require_curriculum=False))


@router.put("/me/history")
def save_own_history(payload: SelfHistoryPayload, identity: Identity, session: Database):
    student = student_for(session, identity[0])
    curriculum = student_curriculum(session, student, payload.start_term)
    if curriculum is None:
        raise HTTPException(409, "Não há matriz curricular para este semestre de ingresso.")
    imported = HistoryPayload(
        schema_version=1,
        source="Informado pelo estudante",
        source_reference="manual",
        start_term=payload.start_term,
        current_period=payload.current_period,
        records=payload.records,
    )
    return import_history(
        session, student, identity[0], imported, list_courses(session, curriculum.id)
    )


@router.post("/me/history/preview")
def preview_history(payload: SelfHistoryPayload, identity: Identity, session: Database):
    """Avalia um histórico em edição sem gravá-lo, para o mapa refletir cada mudança."""
    student = student_for(session, identity[0], require_curriculum=False)
    curriculum = student_curriculum(session, student, payload.start_term)
    if curriculum is None:
        raise HTTPException(409, "Não há matriz curricular para este semestre de ingresso.")
    courses = list_courses(session, curriculum.id)
    records = payload.model_dump(exclude_none=True)["records"]
    validate_records(records, CurriculumGraph(courses))
    session.rollback()
    history = {
        "revision": student.history_revision,
        "awaiting_import": not records,
        "current_period": payload.current_period,
        "start_term": payload.start_term,
        "records": records,
    }
    return evaluate(courses, history, requirements=requirements_view(curriculum))


@router.post("/me/history/pdf")
async def read_transcript(request: Request, identity: Identity, session: Database):
    """Lê o PDF do histórico e devolve uma proposta; nada é gravado nesta chamada."""
    if request.headers.get("content-type", "").split(";")[0].strip() != "application/pdf":
        raise HTTPException(415, "Envie o histórico em PDF.")
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > MAX_BYTES:
        raise HTTPException(413, "O PDF excede 5 MB.")
    data = bytearray()
    async for chunk in request.stream():
        data.extend(chunk)
        if len(data) > MAX_BYTES:
            raise HTTPException(413, "O PDF excede 5 MB.")
    try:
        # A extração é custosa em CPU; roda fora do laço de eventos.
        text = await run_in_threadpool(extract_text, bytes(data))
    except TranscriptError as error:
        raise HTTPException(422, str(error)) from error
    finally:
        data.clear()
    student = student_for(session, identity[0])
    result = parse_transcript(text, courses_for(session, student))
    session.rollback()
    if not result["records"] and not result["unmatched"]:
        raise HTTPException(
            422,
            "Nenhuma disciplina encontrada. Confira se o arquivo é o histórico emitido pelo SIGAA.",
        )
    return result


@router.get("/me/progression")
def progression(identity: Identity, session: Database):
    student = student_for(session, identity[0])
    return evaluate(
        courses_for(session, student),
        history_view(session, student),
        requirements=requirements_for(session, student),
    )


@router.get("/me/progression/failure-impact/{course_id}")
def failure_impact(course_id: str, identity: Identity, session: Database):
    student = student_for(session, identity[0])
    try:
        return failure_impact_view(
            courses_for(session, student),
            history_view(session, student),
            requirements_for(session, student),
            course_id,
        )
    except ValueError as error:
        raise HTTPException(404, str(error)) from error


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
    if not student.coordination_managed:
        raise HTTPException(409, "Esta conta usa histórico informado pelo estudante.")
    return import_history(session, student, identity[0], payload, courses_for(session, student))


@router.get("/plans")
def plans(identity: Identity, session: Database):
    student = student_for(session, identity[0])
    courses = courses_for(session, student)
    requirements = requirements_for(session, student)
    return [
        plan_view(session, student, plan, courses, requirements)
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
    result = plan_view(
        session, student, plan, courses_for(session, student), requirements_for(session, student)
    )
    session.commit()
    return result


@router.get("/plans/{plan_id}")
def get_plan(plan_id: str, identity: Identity, session: Database):
    student = student_for(session, identity[0])
    return plan_view(
        session,
        student,
        own_plan(session, student, plan_id),
        courses_for(session, student),
        requirements_for(session, student),
    )


@router.post("/plans/{plan_id}/simulations")
def simulation(plan_id: str, payload: EvaluateDraft, identity: Identity, session: Database):
    student = student_for(session, identity[0])
    plan = own_plan(session, student, plan_id)
    require_version(plan, student, payload.version, payload.history_revision)
    try:
        return evaluate(
            courses_for(session, student),
            history_view(session, student),
            payload.hypothetical_ids,
            payload.planned_ids,
            payload.action.model_dump() if payload.action else None,
            course_layout=(
                {cid: position.model_dump() for cid, position in payload.course_layout.items()}
                if payload.course_layout is not None
                else plan.course_layout
            ),
            requirements=requirements_for(session, student),
            simulated_grades=(
                payload.simulated_grades
                if payload.simulated_grades is not None
                else plan.simulated_grades
            ),
        )
    except ValueError as error:
        raise HTTPException(422, str(error)) from error


@router.put("/plans/{plan_id}")
def save_plan(plan_id: str, payload: SavePlan, identity: Identity, session: Database):
    student = student_for(session, identity[0])
    plan = own_plan(session, student, plan_id)
    require_version(plan, student, payload.version, payload.history_revision)
    courses = courses_for(session, student)
    try:
        evaluated = evaluate(
            courses,
            history_view(session, student),
            payload.hypothetical_ids,
            payload.planned_ids,
            course_layout=(
                {cid: position.model_dump() for cid, position in payload.course_layout.items()}
                if payload.course_layout is not None
                else plan.course_layout
            ),
            simulated_grades=(
                payload.simulated_grades
                if payload.simulated_grades is not None
                else plan.simulated_grades
            ),
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
    plan.course_layout = evaluated["course_layout"]
    plan.simulated_grades = evaluated["simulated_grades"]
    plan.version += 1
    plan.updated_at = now()
    result = plan_view(session, student, plan, courses, requirements_for(session, student))
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


@router.post("/plans/{plan_id}/share")
def share_plan(plan_id: str, identity: Identity, session: Database):
    student = student_for(session, identity[0])
    plan = own_plan(session, student, plan_id)
    if not plan.share_token:
        plan.share_token = token_urlsafe(24)
    session.commit()
    return {"token": plan.share_token}


@router.delete("/plans/{plan_id}/share")
def unshare_plan(plan_id: str, identity: Identity, session: Database):
    student = student_for(session, identity[0])
    plan = own_plan(session, student, plan_id)
    plan.share_token = None
    session.commit()
    return {"status": "revoked"}


@router.get("/public/shared/{token}", tags=["Grade pública"])
def shared_plan(token: str, session: Database):
    plan = (
        session.scalar(select(Plan).where(Plan.share_token == token))
        if 16 <= len(token) <= 64
        else None
    )
    student = session.get(Student, plan.student_id) if plan else None
    owner = session.get(User, student.user_id) if student else None
    if plan is None or owner is None or not owner.active:
        raise HTTPException(404, "Link inválido ou revogado.")
    view = plan_view(
        session, student, plan, courses_for(session, student), requirements_for(session, student)
    )
    return shared_view(view, student_curriculum(session, student))
