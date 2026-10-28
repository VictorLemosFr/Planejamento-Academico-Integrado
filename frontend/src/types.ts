export type Status =
  | "completed"
  | "simulated"
  | "in_progress"
  | "planned"
  | "available"
  | "pending"
  | "locked";
export type ActionKind = "approve" | "revoke" | "plan" | "unplan";
export type FailureLevel = "attention" | "critical" | "refused" | null;
export interface Attempt {
  academic_term: string;
  status: "completed" | "failed" | "in_progress";
  grade?: number | null;
}
export interface CoefficientSummary {
  value: number | null;
  simulated_value: number | null;
  credits: number;
  graded_attempts: number;
  ungraded_attempts: number;
}

export interface Course {
  id: string;
  source_code?: string | null;
  name: string;
  short_name: string;
  period: number | null;
  hours: number;
  type: "mandatory" | "elective";
  prerequisite_ids: string[];
  corequisite_ids?: string[];
  prerequisite_status?: "verified" | "unverified";
  credits?: number | null;
  attempts?: Attempt[];
  failures?: number;
  failure_level?: FailureLevel;
  grade?: number | null;
  simulated_grade?: number | null;
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

export type Program = "CC" | "SI" | "IA" | "EC";
export interface PublicGrid extends Progression {
  curriculum: Requirements;
}

export interface Identity {
  user: { id: string; email: string; role: "student" | "coordination" };
  student: {
    program: Program;
    curriculum: {
      available: boolean;
      id: string | null;
      valid_from: string | null;
      source_url: string | null;
    };
  } | null;
  csrf_token: string;
}
export interface History {
  revision: number;
  awaiting_import: boolean;
  current_period: number;
  start_term: string | null;
  records: {
    course_id: string;
    academic_term: string;
    status: "completed" | "failed" | "in_progress";
    grade?: number | null;
  }[];
  import: {
    source: string;
    source_reference: string;
    created_at: string;
    content_hash: string;
  } | null;
  warnings: { message: string; course_id: string; academic_term: string }[];
}
export type HistoryRecord = History["records"][number];
export interface HistoryUpdate {
  start_term: string;
  current_period: number;
  records: HistoryRecord[];
}
export type CourseLayout = Record<string, { period: number; order: number }>;

export interface Requirements {
  id: string;
  program: Program;
  program_name: string;
  valid_from: string;
  source_url: string;
  official_mandatory_hours: number | null;
  profile_elective_hours: number | null;
  free_elective_hours: number | null;
  complementary_hours: number | null;
  extension_hours: number | null;
  total_hours: number | null;
  standard_semesters: number | null;
}
export interface PublicCurriculum extends Requirements {
  course_count: number;
  mandatory_count: number;
  prerequisites_verified: boolean;
  unverified_count: number;
}
export interface Integralization {
  mandatory: {
    required: number;
    completed: number;
    in_progress: number;
    official_required: number | null;
  };
  profile_electives: {
    required: number | null;
    completed: number;
    in_progress: number;
  };
  untracked: { label: string; hours: number }[];
  total_hours: number | null;
  notes: string[];
}
export interface Forecast {
  remaining_mandatory_ids: string[];
  remaining_mandatory_hours: number;
  remaining_profile_elective_hours: number;
  critical_path_ids: string[];
  critical_path_semesters: number;
  pace_hours_per_semester: number | null;
  load_semesters: number | null;
  estimated_semesters: number;
  current_term: string | null;
  first_remaining_term: string | null;
  earliest_completion_term: string | null;
  estimated_completion_term: string | null;
  prerequisites_verified: boolean;
  assumptions: string[];
}
export interface TranscriptProposal {
  records: (HistoryRecord & { code: string; name: string })[];
  unmatched: TranscriptIssue[];
  ignored: TranscriptIssue[];
  start_term: string | null;
}
export interface TranscriptIssue {
  code: string;
  academic_term: string | null;
  status_text: string | null;
  reason: string;
}

export interface Progression extends Simulation {
  cr?: CoefficientSummary;
  simulated_grades?: Record<string, number>;
  failure_limit?: number;
  failure_rule?: string;
  integralization?: Integralization | null;
  forecast?: Forecast | null;
  course_layout: CourseLayout;
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
  share_token?: string | null;
  created_at: string;
  updated_at: string;
}
export interface ForecastPoint {
  estimated_semesters: number;
  estimated_completion_term: string | null;
  critical_path_semesters: number;
  earliest_completion_term: string | null;
}
export interface FailureImpact {
  course_id: string;
  applicable: boolean;
  reason: string | null;
  in_progress?: boolean;
  failures_after: number;
  failure_level_after: FailureLevel;
  refused_after: boolean;
  failure_limit: number;
  before?: ForecastPoint;
  after?: ForecastPoint;
  delay_semesters?: number;
  extra_hours?: number;
  on_critical_path?: boolean;
  blocked_ids?: string[];
}
export interface SharedPlan {
  name: string;
  target_term: string;
  updated_at: string;
  curriculum: { id: string; program: Program };
  course_layout: CourseLayout;
  integralization?: Integralization | null;
  forecast?: Forecast | null;
  counts: Record<Status, number>;
  planned_hours: number;
  planned_ids: string[];
  hypothetical_ids: string[];
  current_period: number;
  courses: Course[];
  warnings: string[];
}
export interface Draft {
  course_layout?: CourseLayout;
  simulated_grades?: Record<string, number>;
  planned_ids: string[];
  hypothetical_ids: string[];
  version: number;
  history_revision: number;
  action?: { kind: ActionKind; course_id: string };
}
