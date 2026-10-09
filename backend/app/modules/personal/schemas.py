from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

from app.modules.planning.schemas import SimulationAction

Term = Annotated[str, StringConstraints(pattern=r"^\d{4}\.[12]$")]
CourseId = Annotated[str, StringConstraints(min_length=1, max_length=40)]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Login(StrictModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=1024)


class Record(StrictModel):
    course_id: CourseId
    academic_term: Term
    status: Literal["completed", "in_progress", "failed"]


class HistoryPayload(StrictModel):
    schema_version: Literal[1]
    source: str = Field(min_length=1, max_length=120)
    source_reference: str = Field(min_length=1, max_length=255)
    current_period: int = Field(ge=1, le=20)
    records: list[Record] = Field(max_length=2000)


class NewPlan(StrictModel):
    name: str = Field(min_length=1, max_length=120)
    target_term: Term

    @field_validator("name")
    @classmethod
    def nonblank(cls, value):
        if not value.strip():
            raise ValueError("Informe um nome para o plano.")
        return value.strip()


class Draft(StrictModel):
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
