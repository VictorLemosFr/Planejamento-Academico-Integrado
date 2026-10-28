import { useState, type DragEvent } from "react";
import type { Course, CourseLayout, Status } from "../types";
import {
  coursePeriod,
  orderedCourses,
  placementWarning,
} from "../courseLayout";
import { CourseCard } from "./CourseCard";

type ElectiveFilter = "all" | "available" | "locked" | "planned" | "done";
type ElectiveSort = "status" | "name" | "hours" | "dependents";

// Para quem planeja, o que pode ser cursado agora vem primeiro.
const statusOrder: Record<Status, number> = {
  available: 0,
  planned: 1,
  in_progress: 2,
  pending: 3,
  simulated: 4,
  completed: 5,
  locked: 6,
};
const electiveFilters: [ElectiveFilter, string, (c: Course) => boolean][] = [
  ["all", "Todas", () => true],
  ["available", "Disponíveis", (c) => c.status === "available"],
  ["locked", "Bloqueadas", (c) => c.status === "locked"],
  [
    "planned",
    "Planejadas",
    (c) => ["planned", "in_progress"].includes(c.status),
  ],
  ["done", "Concluídas", (c) => ["completed", "simulated"].includes(c.status)],
];
const byName = (a: Course, b: Course) => a.name.localeCompare(b.name, "pt-BR");
const sorters: Record<ElectiveSort, (a: Course, b: Course) => number> = {
  status: (a, b) =>
    statusOrder[a.status] - statusOrder[b.status] || byName(a, b),
  name: byName,
  hours: (a, b) => b.hours - a.hours || byName(a, b),
  dependents: (a, b) =>
    b.dependent_ids.length - a.dependent_ids.length || byName(a, b),
};

export function CurriculumMap({
  courses,
  allCourses = courses,
  selectedId,
  relatedIds,
  onSelect,
  layout = {},
  editable = false,
  onMove,
  canMove = () => true,
  maxPeriod = 20,
  editHint,
  needsInfo = () => false,
}: {
  courses: Course[];
  allCourses?: Course[];
  selectedId: string | null;
  relatedIds: Set<string>;
  onSelect: (id: string) => void;
  layout?: CourseLayout;
  editable?: boolean;
  onMove?: (id: string, period: number | null, beforeId?: string) => void;
  /** No histórico só eletivas se movem, e apenas para períodos já cursados. */
  canMove?: (course: Course) => boolean;
  maxPeriod?: number;
  editHint?: string;
  needsInfo?: (course: Course) => boolean;
}) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [electiveFilter, setElectiveFilter] = useState<ElectiveFilter>("all");
  const [electiveSort, setElectiveSort] = useState<ElectiveSort>("status");
  const periodCount = Math.max(
    8,
    ...Object.values(layout).map((p) => p.period),
  );
  const periods = Array.from({ length: periodCount }, (_, i) => i + 1);
  // O filtro global do mapa já foi aplicado em `courses`; este filtro o refina.
  const catalog = courses.filter(
    (c) => c.type === "elective" && coursePeriod(c, layout) === null,
  );
  const activeTest = electiveFilters.find(
    ([key]) => key === electiveFilter,
  )![2];
  const electives = catalog.filter(activeTest).sort(sorters[electiveSort]);
  const unverified = catalog.some(
    (c) => c.prerequisite_status === "unverified",
  );
  function over(event: DragEvent, target: string) {
    if (!editable || !dragging) return;
    const period = Number(target.replace("period-", ""));
    if (target.startsWith("period-") && period > maxPeriod) return;
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
    if (period !== null && period > maxPeriod) return;
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
        draggable={editable && canMove(course)}
        needsInfo={needsInfo(course)}
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
      {editable && canMove(course) && (
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
            {Array.from({ length: maxPeriod }, (_, i) => i + 1).map((p) => (
              <option key={p} value={p}>
                {p}º período
              </option>
            ))}
          </select>
        </div>
      )}
      {editable &&
        canMove(course) &&
        placementWarning(course, allCourses, layout) && (
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
            {editHint ??
              (editable
                ? "Arraste para mover. Solte sobre um card para inserir antes dele."
                : "Selecione uma disciplina para explorar sua trajetória.")}
          </p>
        </div>
        <span className="shrink-0 text-xs text-slate-500">
          {periodCount} períodos
        </span>
      </div>
      {editable && !editHint && (
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
        <div className="elective-tools">
          <div
            className="chip-group"
            role="group"
            aria-label="Filtrar eletivas"
          >
            {electiveFilters.map(([key, label, test]) => (
              <button
                key={key}
                type="button"
                aria-pressed={electiveFilter === key}
                onClick={() => setElectiveFilter(key)}
              >
                {label}
                <span>{catalog.filter(test).length}</span>
              </button>
            ))}
          </div>
          <label className="elective-sort">
            Ordenar por
            <select
              aria-label="Ordenar eletivas"
              value={electiveSort}
              onChange={(e) => setElectiveSort(e.target.value as ElectiveSort)}
            >
              <option value="status">Situação</option>
              <option value="name">Nome (A–Z)</option>
              <option value="hours">Carga horária</option>
              <option value="dependents">Mais dependentes</option>
            </select>
          </label>
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
            {electiveFilter === "locked" && unverified
              ? "Nenhuma eletiva bloqueada: os pré-requisitos desta matriz ainda não foram confirmados."
              : "Nenhuma eletiva neste filtro."}
          </p>
        )}
      </section>
    </div>
  );
}
