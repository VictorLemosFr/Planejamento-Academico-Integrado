import { useState } from "react";
import { Target } from "lucide-react";
import { formatGrade } from "../academicTerms";
import type { CoefficientSummary } from "../types";

const fmt = (value: number) =>
  value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

/**
 * Calculadora de meta: que média preciso neste semestre para chegar ao CR
 * desejado? CR = Σ(créditos × nota) / Σ créditos (Res. nº 09/2009, art. 3º).
 */
export function CrGoal({
  cr,
  defaultCredits,
}: {
  cr?: CoefficientSummary;
  defaultCredits: number;
}) {
  const current = cr?.value ?? null;
  const done = cr?.credits ?? 0;
  const [target, setTarget] = useState(() =>
    String(current !== null ? Math.min(10, Math.ceil(current + 0.5)) : 7),
  );
  const [credits, setCredits] = useState(String(defaultCredits || 20));
  const goal = Number(target.replace(",", "."));
  const next = Number(credits);
  const valid =
    Number.isFinite(goal) &&
    goal >= 0 &&
    goal <= 10 &&
    Number.isFinite(next) &&
    next > 0;
  const sum = (current ?? 0) * done;
  const needed = valid ? (goal * (done + next) - sum) / next : null;
  const ceiling = valid ? (sum + 10 * next) / (done + next) : null;
  // Com média 10 todo semestre, quantos semestres até a meta?
  const semesters =
    valid && needed !== null && needed > 10 && goal < 10
      ? Math.ceil((goal * done - sum) / (next * (10 - goal)))
      : null;
  return (
    <section className="panel" aria-labelledby="cr-goal-title">
      <div className="panel-head">
        <h2 id="cr-goal-title">
          <Target size={16} aria-hidden="true" /> Meta de CR
        </h2>
        <span className="muted">CR atual {formatGrade(current)}</span>
      </div>
      <div className="goal-inputs">
        <label>
          CR desejado
          <input
            className="field"
            inputMode="decimal"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
        </label>
        <label>
          Créditos neste semestre
          <input
            className="field"
            type="number"
            min="1"
            max="60"
            value={credits}
            onChange={(e) => setCredits(e.target.value)}
          />
        </label>
      </div>
      <div className="goal-result" role="status" aria-live="polite">
        {!valid ? (
          <p>Informe um CR entre 0 e 10 e os créditos do semestre.</p>
        ) : needed! <= 0 ? (
          <p>
            <strong>Meta garantida.</strong> Qualquer média mantém seu CR acima
            de {fmt(goal)}.
          </p>
        ) : needed! <= 10 ? (
          <p>
            Você precisa de média{" "}
            <strong className="goal-number">
              {fmt(Math.ceil(needed! * 100) / 100)}
            </strong>{" "}
            em {next} créditos para chegar a CR {fmt(goal)}.
          </p>
        ) : (
          <p>
            <strong>Não dá em um semestre.</strong> Com 10 em tudo, seu CR chega
            a {fmt(Math.floor(ceiling! * 100) / 100)}
            {semesters
              ? `; mantendo média 10 com ${next} créditos por semestre, seriam ${semesters} semestres.`
              : "."}
          </p>
        )}
        <p className="muted small">
          Conta com {done} créditos já com nota. Reprovação por falta entra como
          zero.
        </p>
      </div>
    </section>
  );
}
