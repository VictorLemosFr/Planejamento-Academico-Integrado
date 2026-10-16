import { useState, type DragEvent } from "react";
import type { Course, CourseLayout } from "../types";
import {
  coursePeriod,
  orderedCourses,
  placementWarning,
} from "../courseLayout";
import { CourseCard } from "./CourseCard";

export function CurriculumMap({
  courses,
  allCourses = courses,
  selectedId,
  relatedIds,
  onSelect,
  layout = {},
  editable = false,
  onMove,
}: {
  courses: Course[];
  allCourses?: Course[];
  selectedId: string | null;
  relatedIds: Set<string>;
  onSelect: (id: string) => void;
  layout?: CourseLayout;
  editable?: boolean;
  onMove?: (id: string, period: number | null, beforeId?: string) => void;
}) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const periodCount = Math.max(
    8,
    ...Object.values(layout).map((p) => p.period),
  );
  const periods = Array.from({ length: periodCount }, (_, i) => i + 1);
  const electives = courses.filter(
    (c) => c.type === "elective" && coursePeriod(c, layout) === null,
  );
  function over(event: DragEvent, target: string) {
    if (!editable || !dragging) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    setDropTarget(target);
    const board = event.currentTarget.closest(".curriculum-board");
    if (board) {
      const box = board.getBoundingClientRect();
      if (event.clientX > box.right - 55) board.scrollLeft += 18;
      else if (event.clientX < box.left + 55) board.scrollLeft -= 18;
    }
  }
  function drop(event: DragEvent, period: number | null, beforeId?: string) {
    if (!editable || !dragging) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer.getData("application/x-pai-course") === dragging)
      onMove?.(dragging, period, beforeId);
    setDragging(null);
    setDropTarget(null);
  }
  const card = (course: Course) => (
    <div
      key={course.id}
      className={`movable-course ${dragging === course.id ? "is-dragging" : ""} ${dropTarget === course.id ? "drop-before" : ""}`}
      onDragOver={(e) => over(e, course.id)}
      onDrop={(e) => drop(e, coursePeriod(course, layout), course.id)}
    >
      <CourseCard
        course={course}
        selected={selectedId === course.id}
        related={relatedIds.has(course.id)}
        onSelect={() => onSelect(course.id)}
        draggable={editable}
        onDragStart={(e) => {
          e.dataTransfer.setData("application/x-pai-course", course.id);
          e.dataTransfer.effectAllowed = "move";
          setDragging(course.id);
        }}
        onDragEnd={() => {
          setDragging(null);
          setDropTarget(null);
        }}
      />
      {editable && (
        <div className="card-move-control">
          <span aria-hidden="true">⠿</span>
          <select
            aria-label={`Mover ${course.name} para período`}
            value={coursePeriod(course, layout) ?? "catalog"}
            onChange={(e) =>
              onMove?.(
                course.id,
                e.target.value === "catalog" ? null : Number(e.target.value),
              )
            }
          >
            {course.type === "elective" && (
              <option value="catalog">Catálogo de eletivas</option>
            )}
            {Array.from({ length: 20 }, (_, i) => i + 1).map((p) => (
              <option key={p} value={p}>
                {p}º período
              </option>
            ))}
          </select>
        </div>
      )}
      {editable && placementWarning(course, allCourses, layout) && (
        <p className="placement-warning">
          Pré-requisito no mesmo período ou posterior.
        </p>
      )}
    </div>
  );

  return (
    <div className={`curriculum-map min-w-0 ${dragging ? "is-arranging" : ""}`}>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Mapa curricular
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {editable
              ? "Arraste para mover. Solte sobre um card para inserir antes dele."
              : "Selecione uma disciplina para explorar sua trajetória."}
          </p>
        </div>
        <span className="shrink-0 text-xs text-slate-500">
          {periodCount} períodos
        </span>
      </div>
      {editable && (
        <p className="map-edit-hint">
          Distribuição desta alternativa · mover cards não simula aprovação.
          Clique em Salvar para manter suas mudanças.
        </p>
      )}
      <div
        className="curriculum-board overflow-x-auto rounded-xl border border-slate-200 bg-white p-4"
        aria-label="Disciplinas por período"
        tabIndex={0}
      >
        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns: `repeat(${periodCount}, 176px)`,
            minWidth: periodCount * 188 - 12,
          }}
        >
          {periods.map((period) => {
            const items = orderedCourses(courses, layout, period);
            const hours = allCourses
              .filter((c) => coursePeriod(c, layout) === period)
              .reduce((sum, c) => sum + c.hours, 0);
            return (
              <section
                className={`period-column ${dropTarget === `period-${period}` ? "drop-active" : ""}`}
                key={period}
                aria-label={`${period}º período`}
                onDragOver={(e) => over(e, `period-${period}`)}
                onDrop={(e) => drop(e, period)}
              >
                <div className="mb-4 border-b border-slate-200 pb-3">
                  <h3 className="text-sm font-semibold">{period}º período</h3>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {items.length} disciplina{items.length !== 1 ? "s" : ""}{" "}
                    exibida{items.length !== 1 ? "s" : ""}
                    {editable && ` · ${hours}h`}
                  </p>
                </div>
                <div className="period-cards space-y-3">
                  {items.map(card)}
                  {!items.length && (
                    <p className="empty-period">
                      {editable
                        ? "Solte uma disciplina aqui"
                        : "Nenhuma neste filtro."}
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
      <section
        className={`elective-catalog mt-6 ${dropTarget === "catalog" ? "drop-active" : ""}`}
        aria-label="Disciplinas eletivas"
        onDragOver={(e) => {
          if (allCourses.find((c) => c.id === dragging)?.type === "elective")
            over(e, "catalog");
        }}
        onDrop={(e) => drop(e, null)}
      >
        <div className="mb-3 flex items-center gap-3">
          <h2 className="text-base font-semibold">Eletivas</h2>
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] text-slate-600">
            {electives.length}
          </span>
        </div>
        {editable && (
          <p className="mb-3 text-xs text-slate-500">
            Arraste uma eletiva para o período desejado ou escolha o período
            abaixo do card.
          </p>
        )}
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
