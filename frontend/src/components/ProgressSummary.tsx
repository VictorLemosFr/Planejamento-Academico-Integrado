import type { Course, Forecast, Integralization } from "../types";

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

function HoursBar({
  label,
  completed,
  inProgress,
  required,
}: {
  label: string;
  completed: number;
  inProgress: number;
  required: number | null;
}) {
  if (!required)
    return (
      <div className="hours-row">
        <div className="hours-row-label">
          <span>{label}</span>
          <span>{completed}h concluídas · requisito não publicado</span>
        </div>
      </div>
    );
  const done = Math.min(completed, required);
  const ongoing = Math.min(inProgress, required - done);
  const percent = Math.round((done / required) * 100);
  return (
    <div className="hours-row">
      <div className="hours-row-label">
        <span>{label}</span>
        <span>
          <strong>{done}h</strong> de {required}h
          {ongoing > 0 && ` · ${ongoing}h em andamento`}
        </span>
      </div>
      <div
        className="hours-bar"
        role="progressbar"
        aria-label={`${label}: ${percent}% concluído`}
        aria-valuemin={0}
        aria-valuemax={required}
        aria-valuenow={done}
      >
        <span
          className="hours-bar-done"
          style={{ width: `${(done / required) * 100}%` }}
        />
        <span
          className="hours-bar-ongoing"
          style={{ width: `${(ongoing / required) * 100}%` }}
        />
      </div>
    </div>
  );
}

/** Percentual da carga que o sistema consegue acompanhar (obrigatórias + perfil). */
export function trackedPercent(integralization?: Integralization | null) {
  if (!integralization) return 0;
  const { mandatory, profile_electives: profile } = integralization;
  const required = mandatory.required + (profile.required ?? 0);
  const done =
    Math.min(mandatory.completed, mandatory.required) +
    Math.min(profile.completed, profile.required ?? 0);
  return required ? Math.round((done / required) * 100) : 0;
}

export function ProgressSummary({
  integralization,
  forecast,
  courses,
  onSelect,
}: {
  integralization?: Integralization | null;
  forecast?: Forecast | null;
  courses: Course[];
  onSelect?: (id: string) => void;
}) {
  if (!integralization || !forecast) return null;
  const byId = new Map(courses.map((course) => [course.id, course]));
  const finished = forecast.estimated_semesters === 0;
  return (
    <section
      className="progress-summary"
      aria-label="Integralização e previsão"
    >
      <div className="summary-card glass-panel">
        <p className="eyebrow">INTEGRALIZAÇÃO</p>
        <h2>
          {trackedPercent(integralization)}%{" "}
          <span>da carga obrigatória e de perfil</span>
        </h2>
        <HoursBar
          label="Obrigatórias"
          completed={integralization.mandatory.completed}
          inProgress={integralization.mandatory.in_progress}
          required={integralization.mandatory.required}
        />
        <HoursBar
          label="Eletivas de perfil"
          completed={integralization.profile_electives.completed}
          inProgress={integralization.profile_electives.in_progress}
          required={integralization.profile_electives.required}
        />
        {integralization.untracked.length > 0 && (
          <p className="summary-footnote">
            Também exigidas, mas não acompanhadas aqui:{" "}
            {integralization.untracked
              .map(
                (item) =>
                  `${item.label.toLocaleLowerCase("pt-BR")} (${item.hours}h)`,
              )
              .join(", ")}
            .
          </p>
        )}
        {integralization.notes.map((note) => (
          <p key={note} className="summary-footnote">
            {note}
          </p>
        ))}
      </div>
      <div className="summary-card glass-panel">
        <p className="eyebrow">PREVISÃO DE CONCLUSÃO</p>
        <h2>
          {finished
            ? "Carga acompanhada concluída"
            : plural(forecast.estimated_semesters, "semestre", "semestres")}
          {!finished && <span> até concluir (estimativa)</span>}
        </h2>
        {forecast.estimated_completion_term && !finished && (
          <p className="forecast-term">
            Conclusão estimada em{" "}
            <strong>{forecast.estimated_completion_term}</strong>
            {forecast.first_remaining_term && (
              <> · contando a partir de {forecast.first_remaining_term}</>
            )}
          </p>
        )}
        <dl className="forecast-limits">
          <div>
            <dt>Mínimo pela cadeia de pré-requisitos</dt>
            <dd>
              {plural(
                forecast.critical_path_semesters,
                "semestre",
                "semestres",
              )}
            </dd>
          </div>
          <div>
            <dt>
              No ritmo médio da grade
              {forecast.pace_hours_per_semester
                ? ` (~${forecast.pace_hours_per_semester}h/semestre)`
                : ""}
            </dt>
            <dd>
              {forecast.load_semesters === null
                ? "—"
                : plural(forecast.load_semesters, "semestre", "semestres")}
            </dd>
          </div>
        </dl>
        {forecast.critical_path_ids.length > 1 && (
          <div
            className="critical-chain"
            aria-label="Maior cadeia de pré-requisitos pendente"
          >
            {forecast.critical_path_ids.map((id, index) => (
              <span key={id}>
                {index > 0 && <span aria-hidden="true">→</span>}
                <a
                  href="#detalhes"
                  onClick={(event) => {
                    event.preventDefault();
                    onSelect?.(id);
                  }}
                >
                  {byId.get(id)?.short_name ?? id}
                </a>
              </span>
            ))}
          </div>
        )}
        {!forecast.prerequisites_verified && (
          <p className="forecast-warning">
            Pré-requisitos desta matriz ainda não confirmados: a cadeia mínima
            pode ser maior.
          </p>
        )}
        <details className="forecast-assumptions">
          <summary>Como calculamos</summary>
          <p>
            Usamos o maior entre dois limites: a maior sequência de obrigatórias
            pendentes que dependem umas das outras (uma por semestre) e a carga
            restante no ritmo médio da própria grade.
          </p>
          <ul>
            {forecast.assumptions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </details>
      </div>
    </section>
  );
}
