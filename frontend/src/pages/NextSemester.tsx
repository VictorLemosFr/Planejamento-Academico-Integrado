import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { termOf } from "../academicTerms";
import { courseName, courseShortName } from "../display";
import { projectSemesters, suggestSemester } from "../planner";
import type { Progression } from "../types";

const loads = [180, 240, 300, 360, 420, 480];

/** Monta o próximo semestre por carga desejada e mostra um caminho até o fim. */
export function NextSemester({
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
  onCreate: (ids: string[], name: string, term: string) => void;
  onSelectCourse: (id: string) => void;
}) {
  const forecast = data.forecast;
  const pace = forecast?.pace_hours_per_semester ?? 360;
  const [budget, setBudget] = useState(
    loads.reduce((best, h) =>
      Math.abs(h - pace) < Math.abs(best - pace) ? h : best,
    ),
  );
  const [electives, setElectives] = useState(true);
  const firstPeriod = data.in_progress_ids.length
    ? currentPeriod + 1
    : currentPeriod;
  const suggestedTerm =
    forecast?.first_remaining_term ??
    (startTerm ? termOf(startTerm, firstPeriod) : "");
  const [term, setTerm] = useState(suggestedTerm);
  const assumed = useMemo(
    () => new Set([...data.official_completed_ids, ...data.in_progress_ids]),
    [data],
  );
  const profileRemaining = forecast?.remaining_profile_elective_hours ?? 0;
  const suggestion = suggestSemester(data.courses, {
    budget,
    includeElectives: electives,
    assumed,
    period: firstPeriod,
    profileRemaining,
  });
  const projection = projectSemesters(data.courses, {
    budget,
    assumed,
    period: firstPeriod,
    profileRemaining,
  });
  const after = new Set([
    ...assumed,
    ...suggestion.picks.map((p) => p.course.id),
  ]);
  const unlocks = data.courses.filter(
    (c) =>
      !after.has(c.id) &&
      c.prerequisite_ids.length > 0 &&
      c.prerequisite_ids.every((id) => after.has(id)) &&
      !c.prerequisite_ids.every((id) => assumed.has(id)),
  );
  const label = (index: number) =>
    startTerm
      ? termOf(startTerm, firstPeriod + index)
      : `${firstPeriod + index}º período`;
  const validTerm = /^\d{4}\.[12]$/.test(term);

  return (
    <div className="page-stack">
      <section className="panel" aria-labelledby="planner-title">
        <div className="panel-head">
          <h2 id="planner-title">
            <Sparkles size={16} aria-hidden="true" /> Sugestão para{" "}
            {term || "o próximo semestre"}
          </h2>
          <span className="muted small">
            Considera aprovadas as {data.in_progress_ids.length} disciplina(s)
            em andamento
          </span>
        </div>
        <div className="planner-controls">
          <label>
            Carga desejada
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
            Semestre
            <input
              className="field"
              value={term}
              pattern="[0-9]{4}\.[12]"
              placeholder="2026.2"
              onChange={(e) => setTerm(e.target.value)}
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={electives}
              onChange={(e) => setElectives(e.target.checked)}
            />
            Incluir eletivas de perfil
          </label>
        </div>
        {suggestion.picks.length ? (
          <table className="data-table" aria-label="Disciplinas sugeridas">
            <thead>
              <tr>
                <th>Disciplina</th>
                <th>Por quê</th>
                <th className="num">Carga</th>
              </tr>
            </thead>
            <tbody>
              {suggestion.picks.map(({ course, reasons }) => (
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
                  {suggestion.picks.length} disciplinas
                  {suggestion.electiveHours
                    ? ` · ${suggestion.electiveHours}h de eletivas`
                    : ""}
                </td>
                <td className="num">
                  <strong>{suggestion.hours}h</strong> de {budget}h
                </td>
              </tr>
            </tfoot>
          </table>
        ) : (
          <p className="muted">
            Nenhuma disciplina liberada para cursar agora.
          </p>
        )}
        {unlocks.length > 0 && (
          <p className="small muted">
            Aprovando estas, você libera em seguida:{" "}
            {unlocks.slice(0, 6).map(courseShortName).join(", ")}
            {unlocks.length > 6 ? ` e mais ${unlocks.length - 6}` : ""}.
          </p>
        )}
        {suggestion.leftOut.length > 0 && (
          <details className="left-out">
            <summary>
              {suggestion.leftOut.length} liberada(s) que ficaram de fora
            </summary>
            <ul>
              {suggestion.leftOut.map(({ course, reason }) => (
                <li key={course.id}>
                  {courseShortName(course)} ·{" "}
                  <span className="muted">{reason}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
        <div className="panel-actions">
          <button
            type="button"
            className="primary-action"
            disabled={busy || !suggestion.picks.length || !validTerm}
            onClick={() =>
              onCreate(
                suggestion.picks.map((p) => p.course.id),
                `Sugestão ${term}`,
                term,
              )
            }
          >
            Criar alternativa com esta sugestão
          </button>
          {!validTerm && (
            <span className="small muted">
              Informe o semestre no formato 2026.2.
            </span>
          )}
        </div>
      </section>

      <section className="panel" aria-labelledby="projection-title">
        <div className="panel-head">
          <h2 id="projection-title">Um caminho possível até a formatura</h2>
          <span className="muted small">
            {budget}h por semestre, priorizando o caminho crítico
          </span>
        </div>
        <ol className="timeline">
          {projection.semesters.map((s) => (
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
                {s.electiveHours > 0 && (
                  <span className="chip chip-simulated">
                    {s.electiveHours}h de eletivas
                  </span>
                )}
              </div>
            </li>
          ))}
        </ol>
        <p className="small muted">
          {projection.stuck
            ? "O caminho para antes do fim: há disciplinas presas por recusa de matrícula ou pré-requisitos."
            : `${projection.semesters.length} semestre(s) neste ritmo. A previsão mínima do sistema é de ${forecast?.estimated_semesters ?? "—"}; não considera oferta de turmas nem choque de horários.`}
        </p>
      </section>
    </div>
  );
}
