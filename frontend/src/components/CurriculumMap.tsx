import type { Course } from "../types";
import { CourseCard } from "./CourseCard";

export function CurriculumMap({
  courses,
  selectedId,
  relatedIds,
  onSelect,
}: {
  courses: Course[];
  selectedId: string | null;
  relatedIds: Set<string>;
  onSelect: (id: string) => void;
}) {
  const periods = Array.from({ length: 8 }, (_, index) => index + 1);
  const electives = courses.filter((course) => course.type === "elective");
  const card = (course: Course) => (
    <CourseCard
      key={course.id}
      course={course}
      selected={selectedId === course.id}
      related={relatedIds.has(course.id)}
      onSelect={() => onSelect(course.id)}
    />
  );

  return (
    <div className="min-w-0">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Mapa curricular
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Selecione uma disciplina para explorar sua trajetória.
          </p>
        </div>
        <span className="shrink-0 text-xs text-slate-500">8 períodos</span>
      </div>
      <div
        className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-4"
        aria-label="Disciplinas por período"
        tabIndex={0}
      >
        <div className="grid min-w-[1510px] grid-cols-8 gap-3">
          {periods.map((period) => {
            const items = courses.filter((course) => course.period === period);
            return (
              <section key={period} aria-label={`${period}º período`}>
                <div className="mb-4 border-b border-slate-200 pb-3">
                  <h3 className="text-sm font-semibold">{period}º período</h3>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {items.length} disciplina{items.length !== 1 ? "s" : ""}{" "}
                    exibida{items.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="space-y-3">
                  {items.map(card)}
                  {!items.length && (
                    <p className="text-xs text-slate-400">
                      Nenhuma neste filtro.
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
      <section className="mt-6" aria-label="Disciplinas eletivas">
        <div className="mb-3 flex items-center gap-3">
          <h2 className="text-base font-semibold">Eletivas</h2>
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] text-slate-600">
            {electives.length}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {electives.map(card)}
        </div>
        {!electives.length && (
          <p className="text-sm text-slate-500">
            Nenhuma eletiva neste filtro.
          </p>
        )}
      </section>
    </div>
  );
}
