import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import * as api from "../api";
import { courseShortName } from "../display";
import type { Course } from "../types";

const levels = {
  attention: "atenção",
  critical: "crítico",
  refused: "matrícula recusada",
};

/** "E se eu reprovar?": quanto a reprovação atrasa a formatura e o que trava. */
export function FailureImpactPanel({
  course,
  courses,
  revision,
}: {
  course: Course;
  courses: Course[];
  revision: number;
}) {
  const [open, setOpen] = useState(false);
  const impact = useQuery({
    queryKey: ["failure-impact", course.id, revision],
    queryFn: () => api.getFailureImpact(course.id),
    enabled: open,
  });
  const byId = new Map(courses.map((c) => [c.id, c]));
  if (course.status === "completed") return null;
  const data = impact.data;
  return (
    <section className="impact" aria-label="E se eu reprovar?">
      {!open ? (
        <button
          type="button"
          className="impact-trigger"
          onClick={() => setOpen(true)}
        >
          <TriangleAlert size={15} aria-hidden="true" /> E se eu reprovar?
        </button>
      ) : (
        <>
          <h3 className="details-section-title">E se eu reprovar?</h3>
          {impact.isLoading && <p className="muted small">Calculando…</p>}
          {impact.error && (
            <p className="details-note warn">{impact.error.message}</p>
          )}
          {data && !data.applicable && (
            <p className="details-note">{data.reason}</p>
          )}
          {data?.applicable && data.before && data.after && (
            <>
              <p className="impact-headline" data-delay={data.delay_semesters}>
                {data.delay_semesters ? (
                  <>
                    Formatura de{" "}
                    <strong>
                      {data.before.estimated_completion_term ??
                        `${data.before.estimated_semesters} sem.`}
                    </strong>{" "}
                    para{" "}
                    <strong>
                      {data.after.estimated_completion_term ??
                        `${data.after.estimated_semesters} sem.`}
                    </strong>{" "}
                    (+{data.delay_semesters} semestre
                    {data.delay_semesters > 1 ? "s" : ""})
                  </>
                ) : (
                  <>
                    Não atrasa a previsão: as {data.extra_hours}h extras cabem
                    nos semestres que já restam.
                  </>
                )}
              </p>
              {!!data.delay_semesters && (
                <p className="small muted">
                  {data.on_critical_path
                    ? "Ela está no caminho crítico: cada semestre de atraso nela empurra a formatura."
                    : data.blocked_ids?.length
                      ? "As disciplinas que dependem dela também atrasam."
                      : `Atrasa pela carga: mais ${data.extra_hours}h para cursar no ritmo da grade.`}
                </p>
              )}
              <p
                className="details-note"
                data-level={data.failure_level_after ?? undefined}
              >
                Seria sua {data.failures_after}ª reprovação nesta disciplina:{" "}
                <strong>
                  {data.failure_level_after
                    ? levels[data.failure_level_after]
                    : ""}
                </strong>
                {data.refused_after
                  ? " (Res. nº 09/2009: na 3ª reprovação a matrícula é recusada)."
                  : "."}
              </p>
              {!!data.blocked_ids?.length && (
                <p className="small muted">
                  Ficariam travadas até a aprovação:{" "}
                  {data.blocked_ids
                    .slice(0, 5)
                    .map((id) =>
                      byId.get(id) ? courseShortName(byId.get(id)!) : id,
                    )
                    .join(", ")}
                  {data.blocked_ids.length > 5
                    ? ` e mais ${data.blocked_ids.length - 5}`
                    : ""}
                  .
                </p>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
