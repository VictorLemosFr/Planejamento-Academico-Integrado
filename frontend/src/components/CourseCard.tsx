import type { HTMLAttributes, Ref } from "react";
import { GripVertical } from "lucide-react";
import { formatGrade } from "../academicTerms";
import { courseName, courseShortName } from "../display";
import type { Course, FailureLevel, Status } from "../types";

export const statusMeta: Record<
  Status,
  { label: string; icon: string; style: string }
> = {
  completed: {
    label: "Concluída",
    icon: "✓",
    style: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  simulated: {
    label: "Aprovação simulada",
    icon: "◇",
    style: "border-teal-300 bg-teal-50 text-teal-800",
  },
  in_progress: {
    label: "Em andamento",
    icon: "◷",
    style: "border-sky-200 bg-sky-50 text-sky-800",
  },
  available: {
    label: "Disponível",
    icon: "●",
    style: "border-blue-200 bg-blue-50 text-blue-800",
  },
  planned: {
    label: "Planejada",
    icon: "◆",
    style: "border-violet-200 bg-violet-50 text-violet-800",
  },
  pending: {
    label: "Pendente",
    icon: "!",
    style: "border-amber-200 bg-amber-50 text-amber-800",
  },
  locked: {
    label: "Bloqueada",
    icon: "⊘",
    style: "border-slate-200 bg-slate-50 text-slate-500",
  },
};

const failureLabel: Record<Exclude<FailureLevel, null>, string> = {
  attention: "atenção",
  critical: "crítico",
  refused: "matrícula recusada",
};

export function failureText(count: number) {
  return `${count} reprovaç${count === 1 ? "ão" : "ões"}`;
}

/** Bolinhas ●●○: quantas reprovações já ocorreram até o limite da resolução. */
export function FailureDots({
  count,
  limit = 3,
}: {
  count: number;
  limit?: number;
}) {
  return (
    <span className="failure-dots" aria-hidden="true">
      {Array.from({ length: limit }, (_, i) => (
        <i key={i} data-on={i < count || undefined} />
      ))}
    </span>
  );
}

export function CourseCard({
  course,
  selected,
  related,
  dimmed = false,
  onCriticalPath = false,
  onSelect,
  needsInfo = false,
  dragHandle,
  buttonRef,
}: {
  course: Course;
  selected: boolean;
  related: boolean;
  dimmed?: boolean;
  onCriticalPath?: boolean;
  onSelect: () => void;
  /** Histórico: cadeira do 1º período ainda sem situação informada. */
  needsInfo?: boolean;
  /** Eventos de arraste do dnd-kit; o clique continua selecionando. */
  dragHandle?: HTMLAttributes<HTMLButtonElement>;
  buttonRef?: Ref<HTMLButtonElement>;
}) {
  const meta = statusMeta[course.status];
  const failures = course.failures ?? 0;
  return (
    <button
      ref={buttonRef}
      type="button"
      {...dragHandle}
      aria-label={courseName(course)}
      data-course-id={course.id}
      aria-pressed={selected}
      onClick={onSelect}
      data-status={course.status}
      data-related={related || undefined}
      data-dimmed={dimmed || undefined}
      data-critical-path={onCriticalPath || undefined}
      data-draggable={dragHandle ? true : undefined}
      className={`course-card w-full text-left ${selected ? "is-selected" : ""}`}
    >
      <div className="card-top">
        <span className="status-pill">
          <span aria-hidden="true">{meta.icon}</span> {meta.label}
        </span>
        <span className="card-hours">
          {course.hours}h
          {dragHandle && (
            <GripVertical className="grip" size={14} aria-hidden="true" />
          )}
        </span>
      </div>
      <h3>{courseShortName(course)}</h3>
      <div className="card-foot">
        {needsInfo && (
          <span className="chip chip-warn">Informe a situação</span>
        )}
        {failures > 0 && course.failure_level && (
          <span
            className={`chip chip-failure level-${course.failure_level}`}
            title={`${failureText(failures)} na mesma disciplina`}
          >
            <FailureDots count={failures} />
            {failureText(failures)} · {failureLabel[course.failure_level]}
          </span>
        )}
        {course.status === "completed" &&
          course.grade !== null &&
          course.grade !== undefined && (
            <span className="chip chip-grade">
              Nota {formatGrade(course.grade)}
            </span>
          )}
        {course.simulated_grade !== null &&
          course.simulated_grade !== undefined && (
            <span className="chip chip-simulated">
              Nota simulada {formatGrade(course.simulated_grade)}
            </span>
          )}
        {course.type === "elective" && <span className="chip">Eletiva</span>}
        {course.prerequisite_ids.length > 0 && (
          <span className="chip chip-muted">
            {course.prerequisite_ids.length} pré-req.
          </span>
        )}
        {course.critical && (
          <span
            className="critical-dot"
            role="img"
            aria-label={`Crítica: ${course.dependent_ids.length} disciplinas dependem dela`}
            title={`Crítica: ${course.dependent_ids.length} disciplinas dependem dela`}
          />
        )}
      </div>
    </button>
  );
}
