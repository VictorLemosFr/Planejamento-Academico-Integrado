import { courseName } from "../display";
import { coursePeriod } from "../courseLayout";
import { formatGrade } from "../academicTerms";
import type { Course, CourseLayout } from "../types";
import { statusMeta } from "./CourseCard";

/**
 * Versão para impressão: escondida na tela, é o que sai no "Exportar PDF"
 * (o navegador salva a impressão como PDF).
 */
export function PrintReport({
  title,
  subtitle,
  facts,
  courses,
  layout = {},
  showGrades = false,
}: {
  title: string;
  subtitle: string;
  facts: [string, string][];
  courses: Course[];
  layout?: CourseLayout;
  showGrades?: boolean;
}) {
  const periods = new Map<number | null, Course[]>();
  for (const course of courses) {
    const period = coursePeriod(course, layout);
    periods.set(period, [...(periods.get(period) ?? []), course]);
  }
  const keys = [...periods.keys()].sort((a, b) => (a ?? 99) - (b ?? 99));
  return (
    <article className="print-report" aria-hidden="true">
      <header>
        <p>Planejamento Acadêmico Integrado · CIn/UFPE</p>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </header>
      <dl className="print-facts">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {keys.map((period) => {
        const items = periods
          .get(period)!
          .filter(
            (c) =>
              period !== null ||
              !["available", "locked", "pending"].includes(c.status),
          );
        if (!items.length) return null;
        return (
          <section key={period ?? "electives"}>
            <h2>
              {period === null
                ? "Eletivas cursadas ou planejadas"
                : `${period}º período`}
            </h2>
            <table>
              <thead>
                <tr>
                  <th>Disciplina</th>
                  <th>Carga</th>
                  <th>Situação</th>
                  {showGrades && <th>Nota</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id}>
                    <td>{courseName(c)}</td>
                    <td>{c.hours}h</td>
                    <td>{statusMeta[c.status].label}</td>
                    {showGrades && (
                      <td>{c.grade != null ? formatGrade(c.grade) : ""}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
      <footer>
        Gerado em {new Date().toLocaleString("pt-BR")}. Dados informados pelo
        estudante; a matrícula oficial continua no SIGAA.
      </footer>
    </article>
  );
}
