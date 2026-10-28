import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router";
import * as api from "../api";
import { AppShell } from "../components/AppShell";
import { CourseDetails } from "../components/CourseDetails";
import { CurriculumMap } from "../components/CurriculumMap";
import { KpiStrip } from "../components/KpiStrip";
import { ProgressSummary } from "../components/ProgressSummary";

/** Plano compartilhado por link: somente leitura, sem notas nem identidade. */
export function SharedPlanView() {
  // O App escolhe a tela pelo caminho (sem <Routes>), então o token vem dele.
  const token = decodeURIComponent(
    useLocation().pathname.split("/compartilhado/")[1] ?? "",
  ).replace(/\/$/, "");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const shared = useQuery({
    queryKey: ["shared", token],
    queryFn: () => api.getSharedPlan(token),
  });
  const plan = shared.data;
  const selected = plan?.courses.find((c) => c.id === selectedId);
  return (
    <AppShell
      title={plan ? plan.name : "Plano compartilhado"}
      subtitle={
        plan
          ? `Somente leitura · matriz ${plan.curriculum.id} · semestre-alvo ${plan.target_term}`
          : undefined
      }
      signedIn={false}
      footer={
        <p className="institution-note">
          Plano montado por um estudante no Planejamento Acadêmico Integrado.
          Não substitui a matrícula no SIGAA.
        </p>
      }
    >
      {shared.isLoading && <p role="status">Carregando plano…</p>}
      {shared.error && (
        <section className="panel empty-state">
          <h2>Link indisponível</h2>
          <p className="muted">{shared.error.message}</p>
        </section>
      )}
      {plan && (
        <>
          <KpiStrip
            mode="shared"
            integralization={plan.integralization}
            forecast={plan.forecast}
            counts={[
              { label: "planejadas", value: plan.planned_ids.length },
              {
                label: "aprov. simuladas",
                value: plan.hypothetical_ids.length,
              },
            ]}
          />
          <div className="workspace-grid">
            <CurriculumMap
              courses={plan.courses}
              selectedId={selectedId}
              relatedIds={
                new Set(
                  selected
                    ? [...selected.prerequisite_ids, ...selected.dependent_ids]
                    : [],
                )
              }
              onSelect={setSelectedId}
              layout={plan.course_layout}
              criticalPathIds={plan.forecast?.critical_path_ids}
            />
            <CourseDetails
              course={selected}
              courses={plan.courses}
              busy={false}
              readOnly
              readOnlyHint="Plano compartilhado: somente leitura."
              onAction={() => undefined}
              onSelect={setSelectedId}
              onClose={() => setSelectedId(null)}
            />
          </div>
          <div className="mt-6">
            <ProgressSummary
              integralization={plan.integralization}
              forecast={plan.forecast}
              courses={plan.courses}
              onSelect={setSelectedId}
            />
          </div>
        </>
      )}
    </AppShell>
  );
}
