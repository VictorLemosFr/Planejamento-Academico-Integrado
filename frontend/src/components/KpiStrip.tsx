import type { ReactNode } from "react";
import { formatGrade } from "../academicTerms";
import type { Forecast, Integralization } from "../types";
import { trackedPercent } from "./ProgressSummary";

/**
 * Faixa fixa no topo: os números que o estudante consulta o tempo todo ficam
 * visíveis enquanto ele rola o mapa.
 */
export function KpiStrip({
  mode,
  cr,
  simulatedCr,
  ungraded = 0,
  integralization,
  forecast,
  counts,
  dirty = false,
  action,
  plan,
}: {
  mode: "history" | "simulation" | "public" | "shared";
  cr?: number | null;
  simulatedCr?: number | null;
  ungraded?: number;
  integralization?: Integralization | null;
  forecast?: Forecast | null;
  counts?: { label: string; value: ReactNode }[];
  dirty?: boolean;
  /** Botão de salvar do modo atual, para não duplicar ações pela página. */
  action?: ReactNode;
  /** Simulação: quando este plano forma, ou o que falta pôr num semestre. */
  plan?: { term: string | null; unscheduled: number; electiveHours: number };
}) {
  const percent = trackedPercent(integralization);
  const showSimulated = mode === "simulation" && simulatedCr != null;
  return (
    <section
      className="kpi-strip"
      data-mode={mode}
      aria-label="Resumo da trajetória"
    >
      <span className="mode-badge">
        {mode === "history"
          ? "Histórico real"
          : mode === "simulation"
            ? "Simulação · rascunho"
            : mode === "shared"
              ? "Compartilhado · somente leitura"
              : "Exploração · nada é salvo"}
      </span>
      {(mode === "history" || mode === "simulation") && (
        <div className="kpi" data-kpi="cr">
          <strong>{formatGrade(showSimulated ? simulatedCr : cr)}</strong>
          <span>
            {showSimulated ? "CR simulado" : "CR"}
            {!showSimulated && ungraded > 0 ? ` · ${ungraded} sem nota` : ""}
          </span>
        </div>
      )}
      <div className="kpi" data-kpi="progress">
        <strong>{percent}%</strong>
        <span>integralizado</span>
        <i className="kpi-bar" aria-hidden="true">
          <b style={{ width: `${percent}%` }} />
        </i>
      </div>
      {plan && (
        <div className="kpi" data-kpi="plan">
          <strong>{plan.term ?? "Plano parcial"}</strong>
          <span>
            {plan.term
              ? "formatura neste plano"
              : [
                  plan.unscheduled
                    ? `${plan.unscheduled} obrigatória(s) sem semestre`
                    : "",
                  plan.electiveHours
                    ? `${plan.electiveHours}h de eletivas sem semestre`
                    : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
          </span>
        </div>
      )}
      {forecast && !plan && (
        <div className="kpi" data-kpi="forecast">
          <strong>
            {forecast.estimated_semesters} sem.
            {forecast.estimated_completion_term && (
              <small> · {forecast.estimated_completion_term}</small>
            )}
          </strong>
          <span>previsão de conclusão</span>
        </div>
      )}
      {counts?.map(({ label, value }) => (
        <div key={label} className="kpi kpi-minor">
          <strong>{value}</strong>
          <span>{label}</span>
        </div>
      ))}
      {(dirty || action) && (
        <div className="kpi-actions">
          {dirty && (
            <span className="unsaved-dot" role="note">
              Não salvo
            </span>
          )}
          {action}
        </div>
      )}
    </section>
  );
}
