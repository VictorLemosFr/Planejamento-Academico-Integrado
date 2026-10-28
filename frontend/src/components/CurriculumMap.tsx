import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type CollisionDetection,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import type { Course, CourseLayout, Status } from "../types";
import {
  coursePeriod,
  orderedCourses,
  placementWarning,
} from "../courseLayout";
import { courseName } from "../display";
import { CourseCard, statusMeta } from "./CourseCard";

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
const byName = (a: Course, b: Course) =>
  courseName(a).localeCompare(courseName(b), "pt-BR");
const sorters: Record<ElectiveSort, (a: Course, b: Course) => number> = {
  status: (a, b) =>
    statusOrder[a.status] - statusOrder[b.status] || byName(a, b),
  name: byName,
  hours: (a, b) => b.hours - a.hours || byName(a, b),
  dependents: (a, b) =>
    b.dependent_ids.length - a.dependent_ids.length || byName(a, b),
};
const legendOrder: Status[] = [
  "completed",
  "simulated",
  "in_progress",
  "planned",
  "available",
  "pending",
  "locked",
];

type Arrow = { from: string; to: string; kind: "pre" | "dep" | "co" | "path" };
type Drawn = Arrow & { d: string };

// O alvo é o que está sob o ponteiro (o card antes do período que o contém);
// no teclado, sem ponteiro, vale a maior sobreposição.
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : rectIntersection(args);
};

function readPreference(key: string, fallback: boolean) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value === "1";
  } catch {
    return fallback;
  }
}
function writePreference(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? "1" : "0");
  } catch {
    // Preferência apenas visual; sem armazenamento, segue o padrão.
  }
}

function Droppable({
  id,
  disabled = false,
  className,
  children,
  label,
}: {
  id: string;
  disabled?: boolean;
  className: string;
  children: ReactNode;
  label: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled });
  return (
    <section
      ref={setNodeRef}
      aria-label={label}
      className={`${className} ${isOver && !disabled ? "drop-active" : ""}`}
    >
      {children}
    </section>
  );
}

function MovableCard({
  course,
  enabled,
  register,
  children,
}: {
  course: Course;
  enabled: boolean;
  register: (id: string, node: HTMLElement | null) => void;
  children: (props: {
    handle?: HTMLAttributes<HTMLButtonElement>;
    dragging: boolean;
  }) => ReactNode;
}) {
  const draggable = useDraggable({ id: course.id, disabled: !enabled });
  const droppable = useDroppable({ id: `card-${course.id}` });
  return (
    <div
      ref={(node) => {
        draggable.setNodeRef(node);
        droppable.setNodeRef(node);
        register(course.id, node);
      }}
      className={`movable-course ${draggable.isDragging ? "is-dragging" : ""} ${droppable.isOver && !draggable.isDragging ? "drop-before" : ""}`}
    >
      {children({
        handle: enabled
          ? ({
              ...draggable.listeners,
              "aria-roledescription": "disciplina arrastável",
              "aria-describedby": draggable.attributes["aria-describedby"],
            } as HTMLAttributes<HTMLButtonElement>)
          : undefined,
        dragging: draggable.isDragging,
      })}
    </div>
  );
}

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
  minPeriod = 1,
  editHint,
  needsInfo = () => false,
  criticalPathIds = [],
  periodAction,
  filters,
  periodNote,
  periodLabel,
  gapOf,
}: {
  courses: Course[];
  allCourses?: Course[];
  selectedId: string | null;
  relatedIds: Set<string>;
  /** Recebe null quando o card já selecionado é clicado de novo. */
  onSelect: (id: string | null) => void;
  layout?: CourseLayout;
  editable?: boolean;
  onMove?: (id: string, period: number | null, beforeId?: string) => void;
  /** No histórico só eletivas se movem, e apenas para períodos já cursados. */
  canMove?: (course: Course) => boolean;
  maxPeriod?: number;
  /** Simulação: o plano começa no próximo semestre; colunas anteriores são histórico. */
  minPeriod?: number;
  editHint?: string;
  needsInfo?: (course: Course) => boolean;
  /** Maior cadeia de pré-requisitos pendente, vinda da previsão. */
  criticalPathIds?: string[];
  periodAction?: (period: number) => ReactNode;
  /** Busca e filtro da página, na mesma linha do título para o mapa subir. */
  filters?: ReactNode;
  /** Etiqueta curta no cabeçalho do período (ex.: futuro vai para a Simulação). */
  periodNote?: (period: number) => string | null;
  /** Semestre letivo da coluna, por exemplo "2026.2 · atual". */
  periodLabel?: (period: number) => ReactNode;
  gapOf?: (course: Course) => "late" | "skipped" | "unscheduled" | null;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [electiveFilter, setElectiveFilter] = useState<ElectiveFilter>("all");
  const [electiveSort, setElectiveSort] = useState<ElectiveSort>("status");
  const [compact, setCompact] = useState(() =>
    readPreference("pai-map-compact", false),
  );
  const [showPath, setShowPath] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [drawn, setDrawn] = useState<Drawn[]>([]);
  const gridRef = useRef<HTMLDivElement>(null);
  const nodes = useRef(new Map<string, HTMLElement>());
  const register = useCallback((id: string, node: HTMLElement | null) => {
    if (node) nodes.current.set(id, node);
    else nodes.current.delete(id);
  }, []);
  const sensors = useSensors(
    // Distância mínima: um clique simples continua selecionando a disciplina.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 8 },
    }),
    useSensor(KeyboardSensor),
  );

  // CC tem 9 períodos e EC tem 10: a grade usa o maior período da matriz.
  const periodCount = Math.max(
    8,
    ...allCourses.map((c) => c.period ?? 0),
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
  const byId = new Map(allCourses.map((c) => [c.id, c]));
  const selected = selectedId ? byId.get(selectedId) : undefined;
  const pathSet = new Set(showPath ? criticalPathIds : []);
  const focus = selected
    ? new Set([selected.id, ...relatedIds])
    : pathSet.size
      ? pathSet
      : null;

  const arrows: Arrow[] = [];
  if (selected) {
    for (const id of selected.prerequisite_ids)
      arrows.push({ from: id, to: selected.id, kind: "pre" });
    for (const c of allCourses)
      if (c.prerequisite_ids.includes(selected.id))
        arrows.push({ from: selected.id, to: c.id, kind: "dep" });
    for (const id of selected.corequisite_ids ?? [])
      arrows.push({ from: id, to: selected.id, kind: "co" });
  } else if (showPath) {
    criticalPathIds
      .slice(1)
      .forEach((id, i) =>
        arrows.push({ from: criticalPathIds[i], to: id, kind: "path" }),
      );
  }
  const arrowKey = JSON.stringify(arrows) + JSON.stringify(layout) + compact;

  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const draw = () => {
      const box = grid.getBoundingClientRect();
      const result: Drawn[] = [];
      for (const arrow of arrows) {
        const a = nodes.current.get(arrow.from);
        const b = nodes.current.get(arrow.to);
        if (!a || !b || !grid.contains(a) || !grid.contains(b)) continue;
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        const forward = ra.left < rb.left - 4;
        const x1 = (forward ? ra.right : ra.left + ra.width / 2) - box.left;
        const y1 = (forward ? ra.top + ra.height / 2 : ra.bottom) - box.top;
        const x2 = (forward ? rb.left : rb.left + rb.width / 2) - box.left;
        const y2 = (forward ? rb.top + rb.height / 2 : rb.top) - box.top;
        const bend = forward ? Math.max(28, (x2 - x1) / 2) : 0;
        const d = forward
          ? `M${x1},${y1} C${x1 + bend},${y1} ${x2 - bend},${y2} ${x2 - 3},${y2}`
          : `M${x1},${y1} C${x1 + 50},${y1 + 30} ${x2 + 50},${y2 - 30} ${x2},${y2 - 3}`;
        result.push({ ...arrow, d });
      }
      setDrawn(result);
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(grid);
    return () => observer.disconnect();
    // `arrowKey` resume tudo o que muda a posição das setas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrowKey]);

  function target(overId: string): [number | null, string | undefined] | null {
    if (overId === "catalog") return [null, undefined];
    if (overId.startsWith("period-"))
      return [Number(overId.slice(7)), undefined];
    if (overId.startsWith("card-")) {
      const course = byId.get(overId.slice(5));
      if (!course) return null;
      return [coursePeriod(course, layout), course.id];
    }
    return null;
  }
  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }
  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    if (!event.over || !editable) return;
    const id = String(event.active.id);
    const result = target(String(event.over.id));
    if (!result) return;
    const [period, beforeId] = result;
    const course = byId.get(id);
    if (!course || beforeId === id) return;
    if (period === null && course.type !== "elective") return;
    if (period !== null && (period > maxPeriod || period < minPeriod)) return;
    onMove?.(id, period, beforeId);
  }

  const card = (course: Course) => {
    const enabled = editable && canMove(course);
    return (
      <MovableCard
        key={course.id}
        course={course}
        enabled={enabled}
        register={register}
      >
        {({ handle }) => (
          <>
            <CourseCard
              course={course}
              selected={selectedId === course.id}
              related={relatedIds.has(course.id)}
              dimmed={!!focus && !focus.has(course.id)}
              onCriticalPath={pathSet.has(course.id)}
              onSelect={() =>
                onSelect(selectedId === course.id ? null : course.id)
              }
              needsInfo={needsInfo(course)}
              gap={gapOf?.(course)}
              dragHandle={handle}
            />
            {enabled && placementWarning(course, allCourses, layout) && (
              <p className="placement-warning">
                Pré-requisito no mesmo período ou posterior.
              </p>
            )}
          </>
        )}
      </MovableCard>
    );
  };
  const active = activeId ? byId.get(activeId) : undefined;
  const describe = (id: string) => {
    const course = byId.get(id);
    return course ? courseName(course) : "disciplina";
  };
  const place = (overId: string) => {
    const result = target(overId);
    if (!result) return "área inválida";
    const [period, beforeId] = result;
    const where =
      period === null ? "catálogo de eletivas" : `${period}º período`;
    return beforeId ? `${where}, antes de ${describe(beforeId)}` : where;
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            "Para mover, pressione espaço ou Enter, use as setas para escolher o período e pressione espaço de novo. Esc cancela.",
        },
        announcements: {
          onDragStart: ({ active }) =>
            `Movendo ${describe(String(active.id))}.`,
          onDragOver: ({ active, over }) =>
            over
              ? `${describe(String(active.id))} sobre ${place(String(over.id))}.`
              : `${describe(String(active.id))} fora de um período.`,
          onDragEnd: ({ active, over }) =>
            over
              ? `${describe(String(active.id))} solta em ${place(String(over.id))}.`
              : `${describe(String(active.id))} voltou ao lugar.`,
          onDragCancel: ({ active }) =>
            `Movimento de ${describe(String(active.id))} cancelado.`,
        },
      }}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div
        className={`curriculum-map min-w-0 ${activeId ? "is-arranging" : ""} ${compact ? "is-compact" : ""}`}
      >
        <div className="map-toolbar">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Mapa curricular
            </h2>
            <p className="map-subtitle">
              {editHint ??
                (editable
                  ? "Arraste os cards entre os períodos. Solte sobre um card para inserir antes dele."
                  : "Selecione uma disciplina para ver o que ela exige e o que libera.")}
            </p>
          </div>
          {filters}
          <div className="map-actions" role="group" aria-label="Opções do mapa">
            {criticalPathIds.length > 1 && (
              <button
                type="button"
                aria-pressed={showPath}
                onClick={() => setShowPath(!showPath)}
              >
                Caminho crítico
              </button>
            )}
            <button
              type="button"
              aria-pressed={compact}
              onClick={() => {
                setCompact(!compact);
                writePreference("pai-map-compact", !compact);
              }}
            >
              Compacto
            </button>
            <button
              type="button"
              aria-pressed={showLegend}
              aria-expanded={showLegend}
              onClick={() => setShowLegend(!showLegend)}
            >
              Legenda
            </button>
          </div>
        </div>
        {showLegend && (
          <ul className="map-legend" aria-label="Legenda do mapa">
            {legendOrder.map((status) => (
              <li key={status} data-status={status}>
                <span aria-hidden="true">{statusMeta[status].icon}</span>
                {statusMeta[status].label}
              </li>
            ))}
            <li>
              <span className="critical-dot" aria-hidden="true" /> Crítica: 6 ou
              mais disciplinas dependem dela
            </li>
            <li>
              <span className="legend-line pre" aria-hidden="true" />
              Pré-requisito
            </li>
            <li>
              <span className="legend-line dep" aria-hidden="true" />
              Libera
            </li>
            <li>
              <span className="legend-line co" aria-hidden="true" />
              Co-requisito
            </li>
          </ul>
        )}
        {showPath && !selected && (
          <p className="map-path-note">
            Caminho crítico: a maior sequência de obrigatórias pendentes. Cada
            elo exige um semestre; atrasar qualquer uma atrasa a conclusão.
          </p>
        )}
        <div
          className="curriculum-board overflow-x-auto"
          aria-label="Disciplinas por período"
          tabIndex={0}
        >
          <div
            ref={gridRef}
            className="period-grid"
            style={{
              gridTemplateColumns: `repeat(${periodCount}, var(--column-width))`,
            }}
          >
            <svg className="dependency-arrows" aria-hidden="true">
              <defs>
                {(["pre", "dep", "co", "path"] as const).map((kind) => (
                  <marker
                    key={kind}
                    id={`arrow-${kind}`}
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="7"
                    markerHeight="7"
                    orient="auto"
                  >
                    <path d="M0,0 L10,5 L0,10 z" className={`head-${kind}`} />
                  </marker>
                ))}
              </defs>
              {drawn.map((arrow) => (
                <path
                  key={`${arrow.kind}-${arrow.from}-${arrow.to}`}
                  d={arrow.d}
                  className={`arrow arrow-${arrow.kind}`}
                  markerEnd={`url(#arrow-${arrow.kind})`}
                />
              ))}
            </svg>
            {periods.map((period) => {
              const items = orderedCourses(courses, layout, period);
              const hours = allCourses
                .filter((c) => coursePeriod(c, layout) === period)
                .reduce((sum, c) => sum + c.hours, 0);
              return (
                <Droppable
                  key={period}
                  id={`period-${period}`}
                  disabled={
                    !editable || period > maxPeriod || period < minPeriod
                  }
                  label={`${period}º período`}
                  className={`period-column ${editable && (period > maxPeriod || period < minPeriod) ? "is-locked-period" : ""}`}
                >
                  <div className="period-head">
                    <h3>
                      {period}º período
                      {periodLabel && (
                        <span className="period-term">
                          {periodLabel(period)}
                        </span>
                      )}
                    </h3>
                    <p>
                      {items.length} disciplina{items.length !== 1 ? "s" : ""} ·{" "}
                      {hours}h
                    </p>
                    {periodNote?.(period) && (
                      <span className="period-note">{periodNote(period)}</span>
                    )}
                    {periodAction?.(period)}
                  </div>
                  <div className="period-cards">
                    {items.map(card)}
                    {!items.length && (
                      <p className="empty-period">
                        {editable && period <= maxPeriod && period >= minPeriod
                          ? "Solte uma disciplina aqui"
                          : "Nenhuma neste filtro."}
                      </p>
                    )}
                  </div>
                </Droppable>
              );
            })}
          </div>
        </div>
        <Droppable
          id="catalog"
          disabled={!editable || active?.type !== "elective"}
          label="Disciplinas eletivas"
          className="elective-catalog mt-6"
        >
          <div className="mb-3 flex items-center gap-3">
            <h2 className="text-base font-semibold">Eletivas</h2>
            <span className="count-pill">{electives.length}</span>
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
                onChange={(e) =>
                  setElectiveSort(e.target.value as ElectiveSort)
                }
              >
                <option value="status">Situação</option>
                <option value="name">Nome (A–Z)</option>
                <option value="hours">Carga horária</option>
                <option value="dependents">Mais dependentes</option>
              </select>
            </label>
          </div>
          {editable && (
            <p className="mb-3 text-xs text-slate-600">
              Arraste uma eletiva para um período ou de volta para cá.
            </p>
          )}
          <div className="elective-grid">{electives.map(card)}</div>
          {!electives.length && (
            <p className="text-sm text-slate-600">
              {electiveFilter === "locked" && unverified
                ? "Nenhuma eletiva bloqueada: os pré-requisitos desta matriz ainda não foram confirmados."
                : "Nenhuma eletiva neste filtro."}
            </p>
          )}
        </Droppable>
      </div>
      <DragOverlay dropAnimation={null}>
        {active && (
          <div className="drag-preview">
            <CourseCard
              course={active}
              selected={false}
              related={false}
              onSelect={() => undefined}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
