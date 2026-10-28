import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { termOf } from "../academicTerms";
import { courseName, courseShortName } from "../display";
import { projectSemesters } from "../planner";
import type { Progression } from "../types";

const loads = [180, 240, 300, 360, 420, 480];
const ALL = 99;

export type SuggestedPick = { id: string; period: number };

/**
 * Sugestões: monta quantos semestres o estudante quiser (ou até a formatura),
 * por carga desejada, priorizando o caminho crítico. Vira uma alternativa com
 * cada disciplina já na coluna do seu semestre.
 */
export function Suggestions({
  data,
  startTerm,
  currentPeriod,
  busy,
  onCreate,
  onSelectCourse,
}: {
  data: Progression;
  startTerm: string | null;
  currentPeriod: number;
  busy: boolean;
  onCreate: (picks: SuggestedPick[], name: string) => void;
  onSelectCourse: (id: string) => void;
}) {
  const forecast = data.forecast;
  const pace = forecast?.pace_hours_per_semester ?? 360;
  const [budget, setBudget] = useState(
    loads.reduce((best, h) =>
      Math.abs(h - pace) < Math.abs(best - pace) ? h : best,
    ),
  );
  const [count, setCount] = useState(1);
  const [electives, setElectives] = useState(false);
  // O semestre atual já está em curso: o plano começa no próximo.
  const firstPeriod = currentPeriod + 1;
  const assumed = useMemo(
    () => new Set([...data.official_completed_ids, ...data.in_progress_ids]),
    [data],
  );
  const profileRemaining = forecast?.remaining_profile_elective_hours ?? 0;
  const projection = projectSemesters(data.courses, {
    budget,
    assumed,
    period: firstPeriod,
    profileRemaining,
    includeElectives: electives,
  });
  const total = projection.semesters.length;
  const shown = projection.semesters.slice(0, count === ALL ? total : count);
  const first = shown[0];
  const label = (index: number) =>
    startTerm
      ? termOf(startTerm, firstPeriod + index)
      : `${firstPeriod + index}º período`;
  const picks: SuggestedPick[] = shown.flatMap((s) =>
    s.picks.map((p) => ({ id: p.course.id, period: firstPeriod + s.index })),
  );
  const genericElectives = shown.reduce(
    (sum, s) =>
      sum +
      s.electiveHours -
      s.picks
        .filter((p) => p.course.type === "elective")
        .reduce((h, p) => h + p.course.hours, 0),
    0,
  );
  const span =
    shown.length > 1
      ? `${label(0)} a ${label(shown.length - 1)}`
      : shown.length
        ? label(0)
        : "";

  return (
    <div className="page-stack">
      <section className="panel" aria-labelledby="planner-title">
        <div className="panel-head">
          <h2 id="planner-title">
            <Sparkles size={16} aria-hidden="true" /> Plano sugerido
            {span ? ` · ${span}` : ""}
          </h2>
          <span className="muted small">
            Considera aprovadas as {data.in_progress_ids.length} disciplina(s)
            em andamento
          </span>
        </div>
        <div className="planner-controls">
          <label>
            Carga por semestre
            <select
              className="field"
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
            >
              {loads.map((h) => (
                <option key={h} value={h}>
                  {h}h
                  {h === Math.round(pace / 60) * 60 ? " · ritmo da grade" : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Quantos semestres
            <select
              className="field"
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            >
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n} disabled={n > total}>
                  {n === 1 ? "Só o próximo" : `Próximos ${n}`}
                </option>
              ))}
              <option value={ALL}>Até a formatura ({total})</option>
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={electives}
              onChange={(e) => setElectives(e.target.checked)}
            />
            Escolher eletivas de perfil por mim
          </label>
        </div>

        {first?.picks.length ? (
          <table className="data-table" aria-label="Disciplinas sugeridas">
            <caption className="table-caption">
              {label(0)}: por que cada disciplina
            </caption>
            <thead>
              <tr>
                <th>Disciplina</th>
                <th>Por quê</th>
                <th className="num">Carga</th>
              </tr>
            </thead>
            <tbody>
              {first.picks.map(({ course, reasons }) => (
                <tr key={course.id}>
                  <td>
                    <button
                      type="button"
                      className="row-link"
                      onClick={() => onSelectCourse(course.id)}
                    >
                      {courseName(course)}
                    </button>
                  </td>
                  <td>
                    <span className="reason-list">
                      {reasons.map((r) => (
                        <span
                          key={r}
                          className="chip"
                          data-reason={
                            r === "Caminho crítico" ? "critical" : undefined
                          }
                        >
                          {r}
                        </span>
                      ))}
                    </span>
                  </td>
                  <td className="num">{course.hours}h</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>
                  {first.picks.length} disciplinas
                  {first.electiveHours
                    ? ` · ${first.electiveHours}h de eletivas`
                    : ""}
                </td>
                <td className="num">
                  <strong>{first.mandatoryHours + first.electiveHours}h</strong>{" "}
                  de {budget}h
                </td>
              </tr>
            </tfoot>
          </table>
        ) : (
          <p className="muted">
            Nenhuma disciplina liberada para o próximo semestre.
          </p>
        )}

        {shown.length > 1 && (
          <ol className="timeline" aria-label="Semestres sugeridos">
            {shown.map((s) => (
              <li key={s.index}>
                <div className="timeline-term">
                  <strong>{label(s.index)}</strong>
                  <span>{s.mandatoryHours + s.electiveHours}h</span>
                </div>
                <div className="timeline-courses">
                  {s.picks.map((p) => (
                    <span key={p.course.id} className="chip">
                      {courseShortName(p.course)}
                    </span>
                  ))}
                  {s.electiveHours -
                    s.picks
                      .filter((p) => p.course.type === "elective")
                      .reduce((h, p) => h + p.course.hours, 0) >
                    0 && (
                    <span className="chip chip-simulated">
                      {s.electiveHours -
                        s.picks
                          .filter((p) => p.course.type === "elective")
                          .reduce((h, p) => h + p.course.hours, 0)}
                      h de eletivas a escolher
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
        <p className="small muted">
          {projection.stuck
            ? "Há disciplinas presas (recusa de matrícula ou pré-requisito pendente): o caminho para antes do fim."
            : `Neste ritmo você forma em ${label(total - 1)} (${total} semestre${total > 1 ? "s" : ""}). A previsão mínima do sistema é de ${forecast?.estimated_semesters ?? "—"}; oferta de turmas e choque de horários não entram na conta.`}
        </p>
        <div className="panel-actions">
          <button
            type="button"
            className="primary-action"
            disabled={busy || !picks.length}
            onClick={() =>
              onCreate(
                picks,
                shown.length > 1 ? `Sugestão ${span}` : `Sugestão ${label(0)}`,
              )
            }
          >
            Criar alternativa com{" "}
            {shown.length > 1
              ? `estes ${shown.length} semestres`
              : "esta sugestão"}
          </button>
          {genericElectives > 0 && (
            <span className="small muted">
              As {genericElectives}h de eletivas a escolher ficam para você
              arrastar do catálogo.
            </span>
          )}
        </div>
      </section>
    </div>
  );
}
