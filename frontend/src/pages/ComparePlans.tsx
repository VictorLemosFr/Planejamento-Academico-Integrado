import { useState } from "react";
import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { formatGrade } from "../academicTerms";
import { courseShortName } from "../display";
import type { Plan } from "../types";
import { trackedPercent } from "../components/ProgressSummary";

type Metric = {
  label: string;
  value: (plan: Plan) => number | null;
  format: (value: number | null, plan: Plan) => string;
  /** Qual valor é melhor, para destacar a coluna vencedora. */
  better?: "high" | "low";
};

const metrics: Metric[] = [
  {
    label: "Previsão de conclusão",
    value: (p) => p.forecast?.estimated_semesters ?? null,
    format: (v, p) =>
      p.forecast?.estimated_completion_term
        ? `${p.forecast.estimated_completion_term} · ${v} sem.`
        : `${v ?? "—"} sem.`,
    better: "low",
  },
  {
    label: "Integralização",
    value: (p) => trackedPercent(p.integralization),
    format: (v) => `${v ?? 0}%`,
    better: "high",
  },
  {
    label: "CR simulado",
    value: (p) => p.cr?.simulated_value ?? p.cr?.value ?? null,
    format: (v) => formatGrade(v),
    better: "high",
  },
  {
    label: "Carga planejada",
    value: (p) => p.planned_hours,
    format: (v) => `${v ?? 0}h`,
  },
  {
    label: "Disciplinas planejadas",
    value: (p) => p.planned_ids.length,
    format: (v) => String(v ?? 0),
  },
  {
    label: "Aprovações simuladas",
    value: (p) => p.hypothetical_ids.length,
    format: (v) => String(v ?? 0),
  },
];

/** Alternativas lado a lado, com a melhor de cada linha destacada. */
export function ComparePlans({
  plans,
  onOpen,
}: {
  plans: Plan[];
  onOpen: (id: string) => void;
}) {
  const [chosen, setChosen] = useState<string[]>(() =>
    plans.slice(0, 3).map((p) => p.id),
  );
  if (plans.length < 2)
    return (
      <section className="panel empty-state">
        <h2>Crie pelo menos duas alternativas</h2>
        <p className="muted">
          Comparar mostra lado a lado a previsão de formatura, a integralização
          e o CR simulado de cada plano.
        </p>
        <div className="panel-actions">
          <Link to="/proximo-semestre">
            Montar uma sugestão <ArrowRight size={14} aria-hidden="true" />
          </Link>
          <Link to="/simulacao">
            Criar na Simulação <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </section>
    );
  const selected = plans.filter((p) => chosen.includes(p.id));
  const names = new Map(plans.flatMap((p) => p.courses.map((c) => [c.id, c])));
  return (
    <div className="page-stack">
      <fieldset className="panel compare-picker">
        <legend>Alternativas na comparação (até 3)</legend>
        {plans.map((plan) => (
          <label key={plan.id} className="check">
            <input
              type="checkbox"
              checked={chosen.includes(plan.id)}
              disabled={!chosen.includes(plan.id) && chosen.length >= 3}
              onChange={(e) =>
                setChosen(
                  e.target.checked
                    ? [...chosen, plan.id]
                    : chosen.filter((id) => id !== plan.id),
                )
              }
            />
            {plan.name} · {plan.target_term}
          </label>
        ))}
      </fieldset>
      {selected.length >= 2 && (
        <section className="panel" aria-label="Comparação">
          <table className="data-table compare-table">
            <thead>
              <tr>
                <th />
                {selected.map((p) => (
                  <th key={p.id} scope="col">
                    {p.name}
                    <small>{p.target_term}</small>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.map((metric) => {
                const values = selected.map(metric.value);
                const known = values.filter((v): v is number => v !== null);
                const best =
                  metric.better && known.length && new Set(known).size > 1
                    ? metric.better === "high"
                      ? Math.max(...known)
                      : Math.min(...known)
                    : null;
                return (
                  <tr key={metric.label}>
                    <th scope="row">{metric.label}</th>
                    {selected.map((p, i) => (
                      <td
                        key={p.id}
                        data-best={values[i] === best || undefined}
                      >
                        {metric.format(values[i], p)}
                      </td>
                    ))}
                  </tr>
                );
              })}
              <tr>
                <th scope="row">Só nesta alternativa</th>
                {selected.map((p) => {
                  const mine = new Set([
                    ...p.planned_ids,
                    ...p.hypothetical_ids,
                  ]);
                  const others = new Set(
                    selected
                      .filter((o) => o.id !== p.id)
                      .flatMap((o) => [
                        ...o.planned_ids,
                        ...o.hypothetical_ids,
                      ]),
                  );
                  const unique = [...mine].filter((id) => !others.has(id));
                  return (
                    <td key={p.id} className="small">
                      {unique.length
                        ? unique
                            .map((id) =>
                              names.get(id)
                                ? courseShortName(names.get(id)!)
                                : id,
                            )
                            .join(", ")
                        : "—"}
                    </td>
                  );
                })}
              </tr>
              <tr>
                <th scope="row" />
                {selected.map((p) => (
                  <td key={p.id}>
                    <button
                      type="button"
                      className="row-link"
                      onClick={() => onOpen(p.id)}
                    >
                      Abrir na Simulação{" "}
                      <ArrowRight size={14} aria-hidden="true" />
                    </button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          <p className="small muted">
            Valores das versões salvas. A melhor de cada linha fica destacada.
          </p>
        </section>
      )}
    </div>
  );
}
