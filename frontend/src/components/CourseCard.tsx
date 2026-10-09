import type { Course, Status } from "../types";

export const statusMeta: Record<
  Status,
  { label: string; icon: string; style: string }
> = {
  completed: {
    label: "Concluída",
    icon: "✓",
    style: "border-emerald-200 bg-emerald-50 text-emerald-800",
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
}: {
  course: Course;
  selected: boolean;
  related: boolean;
  onSelect: () => void;
}) {
  const meta = statusMeta[course.status];
  return (
    <button
      type="button"
      aria-label={course.name}
      aria-pressed={selected}
      onClick={onSelect}
      className={`w-full rounded-lg border p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${meta.style} ${selected ? "ring-2 ring-blue-600 ring-offset-2" : related ? "ring-1 ring-slate-400" : ""}`}
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
