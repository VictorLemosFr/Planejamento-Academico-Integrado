export type Status =
  "completed" | "planned" | "available" | "pending" | "locked";
export type ActionKind = "approve" | "revoke" | "plan" | "unplan";

export interface Course {
  id: string;
  name: string;
  short_name: string;
  period: number | null;
  hours: number;
  type: "mandatory" | "elective";
  prerequisite_ids: string[];
  status: Status;
  missing_prerequisite_ids: string[];
  dependent_ids: string[];
  critical: boolean;
}

export interface Scenario {
  id: string;
  name: string;
  current_period: number;
  completed_ids: string[];
  planned_ids: string[];
  trail_ids: string[];
}

export interface SimulationRequest {
  current_period: number;
  completed_ids: string[];
  planned_ids: string[];
  action?: { kind: ActionKind; course_id: string };
}

export interface Simulation extends SimulationRequest {
  courses: Course[];
  counts: Record<Status, number>;
  planned_hours: number;
  warnings: string[];
}
