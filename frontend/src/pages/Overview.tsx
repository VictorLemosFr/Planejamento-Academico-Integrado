import { Link } from "react-router";
import {
  ArrowRight,
  CalendarPlus,
  Download,
  FileUp,
  Info,
  Map as MapIcon,
  PencilLine,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { formatGrade, termOf } from "../academicTerms";
import { courseName, courseShortName } from "../display";
import { projectSemesters } from "../planner";
import type { Course, HistoryRecord, Progression } from "../types";
import { BigValue } from "../components/BigValue";
import { CrGoal } from "../components/CrGoal";
import { trackedPercent } from "../components/ProgressSummary";

// Peso no CR: a carga horária, como no SIGAA.
const weightOf = (course?: Course) => course?.hours ?? 60;

/** CR acumulado ao fim de cada semestre com nota. */
export function crTimeline(records: HistoryRecord[], courses: Course[]) {
  const byId = new Map(courses.map((c) => [c.id, c]));
  const terms = [...new Set(records.map((r) => r.academic_term))].sort();
  let weighted = 0;
  let total = 0;
  const points: { term: string; value: number }[] = [];
  for (const term of terms) {
    for (const r of records) {
      if (r.academic_term !== term || r.status === "in_progress") continue;
      if (r.grade === null || r.grade === undefined) continue;
      const weight = weightOf(byId.get(r.course_id));
      weighted += weight * Number(r.grade);
      total += weight;
    }
    if (total) points.push({ term, value: weighted / total });
  }
  return points;
}

function Sparkline({ points }: { points: { term: string; value: number }[] }) {
  if (points.length < 2) return null;
  const w = 160;
  const h = 40;
  const min = Math.min(...points.map((p) => p.value)) - 0.3;
  const max = Math.max(...points.map((p) => p.value)) + 0.3;
  const x = (i: number) => (i / (points.length - 1)) * (w - 8) + 4;
  const y = (v: number) => h - 4 - ((v - min) / (max - min || 1)) * (h - 8);
  const d = points
    .map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.value)}`)
    .join(" ");
  const last = points[points.length - 1];
  return (
    <svg
      className="sparkline"
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={`Evolução do CR: ${points.map((p) => `${p.term} ${formatGrade(p.value)}`).join(", ")}`}
    >
      <path d={d} />
      <circle cx={x(points.length - 1)} cy={y(last.value)} r="3" />
    </svg>
  );
}

export function Overview({
  data,
  records,
  startTerm,
  currentPeriod,
  onSelectCourse,
  onExport,
  onImport,
}: {
  data: Progression;
  records: HistoryRecord[];
  startTerm: string | null;
  currentPeriod: number;
  onSelectCourse: (id: string) => void;
  onExport: () => void;
  onImport: () => void;
}) {
  const { integralization, forecast, cr } = data;
  const percent = trackedPercent(integralization);
  const mandatory = integralization?.mandatory;
  const profile = integralization?.profile_electives;
  const required = (mandatory?.required ?? 0) + (profile?.required ?? 0);
  const doneHours =
    Math.min(mandatory?.completed ?? 0, mandatory?.required ?? 0) +
    Math.min(profile?.completed ?? 0, profile?.required ?? 0);
  const ongoingHours =
    (mandatory?.in_progress ?? 0) + (profile?.in_progress ?? 0);
  const share = (value: number) => (required ? (value / required) * 100 : 0);
  const recorded = new Set(records.map((r) => r.course_id));
  const missing = data.courses.filter(
    (c) =>
      c.type === "mandatory" &&
      (c.period ?? 99) < currentPeriod &&
      !recorded.has(c.id),
  );
  // Do período atual, mas fora deste semestre (só depois que o atual foi preenchido).
  const currentTerm = startTerm ? termOf(startTerm, currentPeriod) : null;
  const skipped = records.some((r) => r.academic_term === currentTerm)
    ? data.courses.filter(
        (c) =>
          c.type === "mandatory" &&
          c.period === currentPeriod &&
          !recorded.has(c.id),
      )
    : [];
  const atRisk = data.courses.filter(
    (c) => c.failure_level === "critical" || c.failure_level === "refused",
  );
  const assumed = new Set([
    ...data.official_completed_ids,
    ...data.in_progress_ids,
  ]);
  // O semestre atual já está em curso: o caminho começa no próximo.
  const firstPeriod = currentPeriod + 1;
  const projection = forecast
    ? projectSemesters(data.courses, {
        budget: forecast.pace_hours_per_semester ?? 360,
        assumed,
        period: firstPeriod,
        profileRemaining: forecast.remaining_profile_elective_hours,
      })
    : null;
  const termLabel = (index: number) =>
    startTerm
      ? termOf(startTerm, firstPeriod + index)
      : `${firstPeriod + index}º período`;
  const timeline = crTimeline(records, data.courses);
  const currentLoad = data.courses
    .filter((c) => c.status === "in_progress")
    .reduce((sum, c) => sum + weightOf(c), 0);
  const activity = [...records]
    .sort((a, b) => b.academic_term.localeCompare(a.academic_term))
    .slice(0, 6);
  const byId = new Map(data.courses.map((c) => [c.id, c]));
  const statusText = {
    completed: "Aprovada",
    failed: "Reprovada",
    in_progress: "Cursando",
  };

  if (!records.length)
    return (
      <div className="overview">
        <section
          className="panel onboarding"
          aria-labelledby="onboarding-title"
        >
          <p className="stat-label">Primeiro passo</p>
          <h2 id="onboarding-title">Preencha seu histórico acadêmico</h2>
          <p className="muted">
            Seu CR, a integralização e a previsão de formatura saem do que você
            já cursou. Enquanto o histórico estiver vazio, esses números não
            dizem nada sobre você.
          </p>
          <div className="onboarding-options">
            <button
              type="button"
              className="onboarding-option primary"
              onClick={onImport}
            >
              <FileUp size={22} aria-hidden="true" />
              <strong>Importar o PDF do SIGAA</strong>
              <span>
                Recomendado. Aprovações, reprovações, notas e o que você está
                cursando são preenchidos em segundos.
              </span>
            </button>
            <Link to="/historico" className="onboarding-option">
              <PencilLine size={22} aria-hidden="true" />
              <strong>Preencher no mapa</strong>
              <span>
                Marque cada período como aprovado ou cursando e ajuste as
                exceções card a card.
              </span>
            </Link>
          </div>
          <p className="privacy-note">
            <ShieldCheck size={15} aria-hidden="true" /> O PDF é lido na hora e
            descartado. A matrícula oficial continua no SIGAA.
          </p>
        </section>
      </div>
    );

  return (
    <div className="overview">
      {!startTerm && (
        <div className="banner" role="note">
          <Info size={16} aria-hidden="true" />
          <span>
            Informe seu semestre de ingresso para datar o histórico e a
            previsão.
          </span>
          <Link to="/historico?editar=1">
            Informar agora <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      )}
      {missing.length > 0 && (
        <div className="banner" role="note">
          <Info size={16} aria-hidden="true" />
          <span>
            <strong>Complete seu histórico acadêmico:</strong> faltam{" "}
            {missing.length} obrigatória{missing.length > 1 ? "s" : ""} de
            períodos que você já cursou.
          </span>
          <button type="button" onClick={onImport}>
            Importar PDF <ArrowRight size={14} aria-hidden="true" />
          </button>
          <Link to="/historico">
            Preencher no mapa <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      )}
      {skipped.length > 0 && (
        <div className="banner" role="note">
          <Info size={16} aria-hidden="true" />
          <span>
            {skipped.map(courseShortName).join(", ")}, do {currentPeriod}º
            período, {skipped.length > 1 ? "ficaram" : "ficou"} para depois.
          </span>
          <Link to="/sugestoes">
            Planejar <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      )}
      {atRisk.map((c) => (
        <div key={c.id} className="banner warn" role="note">
          <TriangleAlert size={16} aria-hidden="true" />
          <span>
            {c.failures} reprovações em {courseShortName(c)}
            {c.failure_level === "refused"
              ? ": matrícula recusada (Res. nº 09/2009)."
              : ": mais uma e a matrícula é recusada."}
          </span>
          <button type="button" onClick={() => onSelectCourse(c.id)}>
            Ver disciplina <ArrowRight size={14} aria-hidden="true" />
          </button>
        </div>
      ))}

      <div className="overview-grid">
        <section className="panel stat" aria-label="Coeficiente de rendimento">
          <p className="stat-label">
            Coeficiente de rendimento
            <span
              className="info"
              title="Média das notas ponderada pela carga horária, como no SIGAA; reprovação por falta conta como zero (Res. nº 09/2009-CCEPE)"
            >
              <Info size={13} aria-label="Como é calculado" />
            </span>
          </p>
          <div className="stat-row">
            <BigValue value={cr?.value} />
            <Sparkline points={timeline} />
          </div>
          <p className="stat-note">
            MC {formatGrade(cr?.mc)} · {cr?.hours ?? 0}h com nota
            {cr?.ungraded_attempts
              ? ` · ${cr.ungraded_attempts} tentativa(s) sem nota`
              : ""}
          </p>
          <div className="panel-actions">
            <Link to="/historico">
              <PencilLine size={15} aria-hidden="true" /> Registrar notas
            </Link>
          </div>
        </section>

        <section className="panel stat" aria-label="Integralização">
          <p className="stat-label">Integralização acompanhada</p>
          <BigValue value={percent} digits={0} suffix="%" />
          <div className="segmented" aria-hidden="true">
            <i className="seg-done" style={{ width: `${share(doneHours)}%` }} />
            <i
              className="seg-ongoing"
              style={{ width: `${share(ongoingHours)}%` }}
            />
          </div>
          <ul className="legend-dots">
            <li data-kind="done">Concluído {doneHours}h</li>
            <li data-kind="ongoing">Cursando {ongoingHours}h</li>
            <li data-kind="left">
              Faltam {Math.max(0, required - doneHours - ongoingHours)}h
            </li>
          </ul>
          <div className="panel-actions">
            <Link to="/historico">
              <MapIcon size={15} aria-hidden="true" /> Ver no mapa
            </Link>
            <button type="button" onClick={onExport}>
              <Download size={15} aria-hidden="true" /> Exportar PDF
            </button>
          </div>
        </section>

        <section className="panel stat" aria-label="Previsão de conclusão">
          <p className="stat-label">Previsão de conclusão</p>
          <span className="big-value">
            {forecast?.estimated_completion_term ??
              `${forecast?.estimated_semesters ?? "—"} sem.`}
          </span>
          <p className="stat-note">
            {forecast?.estimated_semesters ?? "—"} semestre(s) restante(s) ·
            caminho crítico de {forecast?.critical_path_semesters ?? "—"}
          </p>
          <div className="panel-actions">
            <Link to="/sugestoes">
              <CalendarPlus size={15} aria-hidden="true" /> Ver sugestões de
              plano
            </Link>
          </div>
        </section>
      </div>

      <div className="overview-grid two">
        <section className="panel" aria-labelledby="path-title">
          <div className="panel-head">
            <h2 id="path-title">Um caminho possível</h2>
            <Link to="/sugestoes" className="link">
              Ver plano completo <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
          {projection && projection.semesters.length ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Semestre</th>
                  <th>Disciplinas</th>
                  <th className="num">Carga</th>
                </tr>
              </thead>
              <tbody>
                {projection.semesters.slice(0, 4).map((s) => (
                  <tr key={s.index}>
                    <td>{termLabel(s.index)}</td>
                    <td className="truncate">
                      {s.picks
                        .map((p) => courseShortName(p.course))
                        .join(", ") || "—"}
                      {s.electiveHours
                        ? ` + ${s.electiveHours}h de eletivas`
                        : ""}
                    </td>
                    <td className="num">
                      {s.mandatoryHours + s.electiveHours}h
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>
                    {projection.stuck
                      ? "Há disciplinas presas (recusa de matrícula ou pré-requisito pendente)."
                      : `Conclusão neste caminho: ${termLabel(projection.semesters.length - 1)}, com ${forecast?.pace_hours_per_semester ?? 360}h por semestre.`}
                  </td>
                </tr>
              </tfoot>
            </table>
          ) : (
            <p className="muted">
              Nada pendente: todas as obrigatórias e eletivas de perfil estão
              cobertas.
            </p>
          )}
        </section>
        <CrGoal cr={cr} defaultHours={currentLoad} />
      </div>

      <section className="panel" aria-labelledby="activity-title">
        <div className="panel-head">
          <h2 id="activity-title">Atividade no histórico</h2>
          <Link to="/historico" className="link">
            Ver histórico <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
        {activity.length ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Semestre</th>
                <th>Disciplina</th>
                <th>Situação</th>
                <th className="num">Nota</th>
              </tr>
            </thead>
            <tbody>
              {activity.map((r, i) => (
                <tr key={`${r.course_id}-${r.academic_term}-${i}`}>
                  <td>{r.academic_term}</td>
                  <td>
                    <button
                      type="button"
                      className="row-link"
                      onClick={() => onSelectCourse(r.course_id)}
                    >
                      {byId.get(r.course_id)
                        ? courseName(byId.get(r.course_id)!)
                        : r.course_id}
                    </button>
                  </td>
                  <td>
                    <span className="status-text" data-attempt={r.status}>
                      {statusText[r.status]}
                    </span>
                  </td>
                  <td
                    className="num"
                    data-negative={r.status === "failed" || undefined}
                  >
                    {r.grade !== null && r.grade !== undefined
                      ? formatGrade(Number(r.grade))
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">
            Nenhuma cadeira registrada ainda. Comece em{" "}
            <Link to="/historico" className="link">
              Meu histórico
            </Link>{" "}
            ou importe o PDF do SIGAA.
          </p>
        )}
      </section>
    </div>
  );
}
