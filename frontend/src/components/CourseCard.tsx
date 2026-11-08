import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type PointerEvent,
  type Ref,
} from "react";
import { motionAllowed } from "../fx/motion";
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

type Fx = "approved" | "unlocked" | "failed" | null;

/**
 * Efeito da última mudança: aprovar solta partículas, liberar acende o card e
 * reprovar (na simulação) faz o card tremer em vermelho.
 */
function useStatusFx(course: Course): Fx {
  const previous = useRef({
    status: course.status,
    failed: !!course.simulated_failure,
  });
  const [fx, setFx] = useState<Fx>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    const before = previous.current;
    const failed = !!course.simulated_failure;
    previous.current = { status: course.status, failed };
    if (!motionAllowed()) return;
    let next: Fx = null;
    if (failed && !before.failed) next = "failed";
    else if (
      ["simulated", "completed"].includes(course.status) &&
      !["simulated", "completed"].includes(before.status)
    )
      next = "approved";
    else if (before.status === "locked" && course.status !== "locked")
      next = "unlocked";
    if (!next) return;
    setFx(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setFx(null), 1100);
  }, [course.status, course.simulated_failure]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return fx;
}

/** Inclinação 3D que acompanha o ponteiro (só mouse; toque arrasta). */
function tilt(event: PointerEvent<HTMLButtonElement>) {
  if (event.pointerType !== "mouse" || !motionAllowed()) return;
  const box = event.currentTarget.getBoundingClientRect();
  const x = (event.clientX - box.left) / box.width - 0.5;
  const y = (event.clientY - box.top) / box.height - 0.5;
  // rotate: eixo (tx, ty, 0) e ângulo proporcional à distância do centro.
  event.currentTarget.style.setProperty("--tx", y.toFixed(3));
  event.currentTarget.style.setProperty("--ty", (-x).toFixed(3));
  event.currentTarget.style.setProperty("--ta", `${Math.hypot(x, y) * 16}deg`);
  event.currentTarget.style.setProperty("--gx", `${(x + 0.5) * 100}%`);
  event.currentTarget.style.setProperty("--gy", `${(y + 0.5) * 100}%`);
}
function untilt(event: PointerEvent<HTMLButtonElement>) {
  event.currentTarget.style.setProperty("--ta", "0deg");
}

const sparks = Array.from({ length: 12 }, (_, i) => i);

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
  gap,
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
  /**
   * Histórico: obrigatória sem registro. "late" = de período já cursado (atrasada);
   * "skipped" = do período atual, mas o estudante não está cursando.
   */
  gap?: "late" | "skipped" | "unscheduled" | "retake" | null;
}) {
  const meta = statusMeta[course.status];
  const failures = course.failures ?? 0;
  const fx = useStatusFx(course);
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
      data-gap={gap || undefined}
      data-sim-failure={course.simulated_failure || undefined}
      data-fx={fx || undefined}
      onPointerMove={tilt}
      onPointerLeave={untilt}
      className={`course-card w-full text-left ${selected ? "is-selected" : ""}`}
    >
      <i className="card-glare" aria-hidden="true" />
      {fx === "approved" && (
        <span className="card-sparks" aria-hidden="true">
          {sparks.map((i) => (
            <i key={i} style={{ "--a": `${i * 30}deg` } as CSSProperties} />
          ))}
        </span>
      )}
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
        {!needsInfo && gap === "late" && (
          <span className="chip chip-warn">Não cursada</span>
        )}
        {course.simulated_failure && (
          <span className="chip chip-sim-failure">
            {course.status === "planned"
              ? "Reprovação simulada · refazer aqui"
              : "Reprovação simulada"}
          </span>
        )}
        {!needsInfo && gap === "retake" && (
          <span className="chip chip-warn">
            Reprovada · refazer em algum semestre
          </span>
        )}
        {!needsInfo && gap === "unscheduled" && (
          <span className="chip chip-warn">Sem semestre no plano</span>
        )}
        {!needsInfo && gap === "skipped" && (
          <span className="chip chip-gap">Não cursando agora</span>
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
