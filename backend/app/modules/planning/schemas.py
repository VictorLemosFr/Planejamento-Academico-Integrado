from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


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
