export type Status =
  | "completed"
  | "simulated"
  | "in_progress"
  | "planned"
  | "available"
  | "pending"
  | "locked";
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

export interface Identity {
  user: { id: string; email: string; role: "student" | "coordination" };
  csrf_token: string;
}
export interface History {
  revision: number;
  awaiting_import: boolean;
  current_period: number;
  records: {
    course_id: string;
    academic_term: string;
    status: "completed" | "failed" | "in_progress";
  }[];
  import: {
    source: string;
    source_reference: string;
    created_at: string;
    content_hash: string;
  } | null;
  warnings: { message: string; course_id: string; academic_term: string }[];
}
export interface Progression extends Simulation {
  official_completed_ids: string[];
  hypothetical_ids: string[];
  in_progress_ids: string[];
  history_revision: number;
  awaiting_import: boolean;
  valid: boolean;
  problems: Record<string, string[]>;
}
export interface Plan extends Progression {
  id: string;
  name: string;
  target_term: string;
  version: number;
  created_at: string;
  updated_at: string;
}
export interface Draft {
  planned_ids: string[];
  hypothetical_ids: string[];
  version: number;
  history_revision: number;
  action?: { kind: ActionKind; course_id: string };
}
