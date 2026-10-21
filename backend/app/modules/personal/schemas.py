import re
from typing import Annotated, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)

from app.modules.planning.schemas import SimulationAction

Term = Annotated[str, StringConstraints(pattern=r"^\d{4}\.[12]$")]
CourseId = Annotated[str, StringConstraints(min_length=1, max_length=40)]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Login(StrictModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=1024)


class Register(StrictModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=1024)
    registration: str = Field(min_length=1, max_length=80)
    current_period: int = Field(ge=1, le=20)
    start_term: Term
    program: Literal["CC", "SI", "IA", "EC"]

    @field_validator("email")
    @classmethod
    def valid_email(cls, value):
        value = value.strip().lower()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
            raise ValueError("E-mail inválido.")
        return value

    @field_validator("registration")
    @classmethod
    def valid_registration(cls, value):
        value = value.strip()
        if not value:
            raise ValueError("Informe a matrícula.")
        return value


class Record(StrictModel):
    course_id: CourseId
    academic_term: Term
    status: Literal["completed", "in_progress", "failed"]


class HistoryPayload(StrictModel):
    schema_version: Literal[1]
    source: str = Field(min_length=1, max_length=120)
    source_reference: str = Field(min_length=1, max_length=255)
    current_period: int = Field(ge=1, le=20)
    start_term: Term | None = None
    records: list[Record] = Field(max_length=2000)


class SelfHistoryPayload(StrictModel):
    start_term: Term
    current_period: int = Field(ge=1, le=20)
    records: list[Record] = Field(max_length=2000)

    @model_validator(mode="after")
    def attempts_after_entry(self):
        if any(record.academic_term < self.start_term for record in self.records):
            raise ValueError("O semestre da tentativa não pode ser anterior ao ingresso.")
        return self


class NewPlan(StrictModel):
    name: str = Field(min_length=1, max_length=120)
    target_term: Term

    @field_validator("name")
    @classmethod
    def nonblank(cls, value):
        if not value.strip():
            raise ValueError("Informe um nome para o plano.")
        return value.strip()


class CoursePosition(StrictModel):
    period: int = Field(ge=1, le=20, strict=True)
    order: int = Field(ge=0, le=500, strict=True)


class Draft(StrictModel):
    course_layout: dict[CourseId, CoursePosition] | None = Field(default=None, max_length=500)
    hypothetical_ids: list[CourseId] = Field(default_factory=list, max_length=500)
    planned_ids: list[CourseId] = Field(default_factory=list, max_length=500)

    @field_validator("hypothetical_ids", "planned_ids")
    @classmethod
    def unique(cls, value):
        if len(set(value)) != len(value):
            raise ValueError("Disciplinas duplicadas.")
        return value


class SavePlan(NewPlan, Draft):
    version: int = Field(ge=1)
    history_revision: int = Field(ge=0)


class EvaluateDraft(Draft):
    version: int = Field(ge=1)
    history_revision: int = Field(ge=0)
    action: SimulationAction | None = None
