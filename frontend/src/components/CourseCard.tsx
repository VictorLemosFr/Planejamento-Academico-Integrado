import type { DragEventHandler } from "react";
import { formatGrade } from "../academicTerms";
import type { Course, FailureLevel, Status } from "../types";

const failureMeta: Record<
  Exclude<FailureLevel, null>,
  { label: string; style: string }
> = {
  attention: { label: "atenção", style: "border-amber-300 text-amber-800" },
  critical: { label: "crítico", style: "border-red-300 text-red-700" },
  refused: {
    label: "matrícula recusada",
    style: "border-red-700 bg-red-700! text-white",
  },
};

export function failureText(count: number) {
  return `${count} reprovaç${count === 1 ? "ão" : "ões"}`;
}

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

export function CourseCard({
  course,
  selected,
  related,
  onSelect,
  draggable = false,
  onDragStart,
  onDragEnd,
  needsInfo = false,
}: {
  course: Course;
  selected: boolean;
  related: boolean;
  onSelect: () => void;
  draggable?: boolean;
  onDragStart?: DragEventHandler<HTMLButtonElement>;
  onDragEnd?: DragEventHandler<HTMLButtonElement>;
  /** Histórico: cadeira do 1º período ainda sem situação informada. */
  needsInfo?: boolean;
}) {
  const meta = statusMeta[course.status];
  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      aria-label={course.name}
      aria-pressed={selected}
      onClick={onSelect}
      data-status={course.status}
      data-related={related || undefined}
      className={`course-card w-full rounded-lg border p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${meta.style} ${selected ? "ring-2 ring-blue-600 ring-offset-2" : related ? "ring-1 ring-slate-400" : ""}`}
    >
      <div className="mb-2 flex items-center justify-between gap-2 text-[11px]">
        <span>
          <span aria-hidden="true">{meta.icon} </span>
          {meta.label}
        </span>
        <span className="font-mono">{course.hours}h</span>
      </div>
      <h3 className="min-h-10 text-[13px] leading-5 font-semibold">
        {course.short_name}
      </h3>
      <div className="mt-3 flex flex-wrap gap-1 text-[10px]">
        {needsInfo && (
          <span className="rounded border border-amber-300 bg-white/80 px-1.5 py-0.5 text-amber-800">
            Informe a situação
          </span>
        )}
        {!!course.failures && course.failure_level && (
          <span
            className={`failure-badge rounded border bg-white/80 px-1.5 py-0.5 ${failureMeta[course.failure_level].style}`}
          >
            {failureText(course.failures)} ·{" "}
            {failureMeta[course.failure_level].label}
          </span>
        )}
        {course.status === "completed" &&
          course.grade !== null &&
          course.grade !== undefined && (
            <span className="rounded bg-white/70 px-1.5 py-0.5 font-medium">
              Nota {formatGrade(course.grade)}
            </span>
          )}
        {course.simulated_grade !== null &&
          course.simulated_grade !== undefined && (
            <span className="rounded border border-teal-300 bg-white/80 px-1.5 py-0.5 text-teal-800">
              Nota simulada {formatGrade(course.simulated_grade)}
            </span>
          )}
        {course.critical && (
          <span className="rounded border border-red-200 bg-white/80 px-1.5 py-0.5 text-red-700">
            Crítica
          </span>
        )}
        {course.type === "elective" && (
          <span className="rounded border border-violet-200 bg-white/80 px-1.5 py-0.5 text-violet-700">
            Eletiva
          </span>
        )}
        {course.prerequisite_ids.length > 0 && (
          <span className="rounded bg-white/60 px-1.5 py-0.5">
            {course.prerequisite_ids.length} pré-requisito
            {course.prerequisite_ids.length > 1 ? "s" : ""}
          </span>
        )}
      </div>
    </button>
  );
}
