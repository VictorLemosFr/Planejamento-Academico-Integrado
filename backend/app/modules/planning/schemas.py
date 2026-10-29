from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class CourseView(BaseModel):
    id: str
    name: str
    short_name: str
    period: int | None
    hours: int
    type: Literal["mandatory", "elective"]
    prerequisite_ids: list[str]


class SimulationAction(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["approve", "revoke", "plan", "unplan"]
    course_id: str = Field(min_length=1, max_length=40)


class SimulationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    current_period: int = Field(ge=1, le=20)
    completed_ids: list[str] = Field(default_factory=list, max_length=500)
    planned_ids: list[str] = Field(default_factory=list, max_length=500)
    action: SimulationAction | None = None


class SimulatedCourse(CourseView):
    status: Literal["completed", "planned", "available", "pending", "locked"]
    missing_prerequisite_ids: list[str]
    dependent_ids: list[str]
    critical: bool


class SimulationResponse(BaseModel):
    current_period: int
    completed_ids: list[str]
    planned_ids: list[str]
    planned_hours: int
    courses: list[SimulatedCourse]
    counts: dict[str, int]
    warnings: list[str]


class Scenario(BaseModel):
    id: str
    name: str
    current_period: int
    completed_ids: list[str]
    planned_ids: list[str]
    trail_ids: list[str]


class PublicEvaluation(BaseModel):
    """Simulação sem conta: nada é gravado e as aprovações são apenas hipotéticas."""

    model_config = ConfigDict(extra="forbid")
    current_period: int = Field(default=1, ge=1, le=20)
    start_term: str | None = Field(default=None, pattern=r"^\d{4}\.[12]$")
    hypothetical_ids: list[str] = Field(default_factory=list, max_length=500)
    action: Literal["approve", "revoke"] | None = None
    course_id: str | None = Field(default=None, min_length=1, max_length=40)
    simulated_grades: dict[str, float] = Field(default_factory=dict, max_length=500)

    @field_validator("simulated_grades")
    @classmethod
    def grade_range(cls, value):
        if any(not 0 <= grade <= 10 for grade in value.values()):
            raise ValueError("Notas simuladas devem ficar entre 0 e 10.")
        return value
