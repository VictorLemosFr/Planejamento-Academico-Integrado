import { useEffect, useState, type ReactNode } from "react";
import { courseName } from "../display";
import type { ActionKind, Course } from "../types";
import { statusMeta } from "./CourseCard";

type Tab = "summary" | "history" | "dependencies";

export function CourseDetails({
  course,
  courses,
  busy,
  onAction,
  onSelect,
  onClose,
  readOnly = false,
  official = false,
  planned = false,
  allowPlanning = true,
  readOnlyHint,
  historySlot,
  simulationSlot,
  moveSlot,
  impactSlot,
}: {
  course: Course | undefined;
  courses: Course[];
  busy: boolean;
  readOnly?: boolean;
  official?: boolean;
  planned?: boolean;
  /** Na grade pública só há simulação de aprovação, sem plano salvo. */
  allowPlanning?: boolean;
  readOnlyHint?: string;
  /** Modo "Meu histórico": edição das tentativas reais no lugar das ações de simulação. */
  historySlot?: ReactNode;
  simulationSlot?: ReactNode;
  /** Alternativa acessível ao arraste: escolher o período numa lista. */
  moveSlot?: ReactNode;
  /** "E se eu reprovar?", com base no histórico real. */
  impactSlot?: ReactNode;
  onAction: (kind: ActionKind) => void;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>(historySlot ? "history" : "summary");
  const courseId = course?.id;
  const hasHistory = !!historySlot;
  useEffect(() => {
    setTab(hasHistory ? "history" : "summary");
  }, [courseId, hasHistory]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);
  const buttonStyle =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium hover:bg-slate-50";
  const byId = new Map(courses.map((item) => [item.id, item]));
  const references = (ids: string[]) => (
    <div className="mt-2 space-y-1.5">
      {ids.map((id) => {
        const item = byId.get(id);
        if (!item) return null;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            className="reference-row"
          >
            <span
              className="reference-status"
              data-status={item.status}
              aria-label={statusMeta[item.status].label}
            >
              {statusMeta[item.status].icon}
            </span>
            <span>{courseName(item)}</span>
          </button>
        );
      })}
    </div>
  );
  const dependents = courses
    .filter((item) => item.prerequisite_ids.includes(course?.id ?? ""))
    .map((item) => item.id);
  const tabs: [Tab, string][] = [
    ["summary", "Resumo"],
    ...(historySlot ? [["history", "Histórico"] as [Tab, string]] : []),
    ["dependencies", "Dependências"],
  ];

  return (
    <>
      {course && (
        <button
          type="button"
          aria-label="Fechar detalhes"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-950/25 lg:hidden"
        />
      )}
      <aside
        id="detalhes"
        aria-label="Detalhes da disciplina"
        className={`details-panel ${course ? "fixed inset-x-0 bottom-0 z-50 max-h-[82dvh] rounded-t-2xl" : "hidden"} overflow-y-auto border p-5 shadow-lg lg:sticky lg:top-24 lg:z-auto lg:block lg:max-h-[calc(100dvh-7rem)] lg:self-start lg:rounded-xl lg:shadow-sm`}
      >
        {!course ? (
          <div className="py-8">
            <span className="text-3xl text-slate-400" aria-hidden="true">
              ↗
            </span>
            <h2 className="mt-4 text-base font-semibold">
              Explore uma disciplina
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Selecione um card para ver o que ele exige, o que libera e, no
              histórico, registrar sua situação. As setas no mapa mostram as
              dependências.
            </p>
          </div>
        ) : (
          <>
            <button
              type="button"
              aria-label="Fechar detalhes"
              onClick={onClose}
              className="float-right ml-2 rounded px-2 py-1 text-xl text-slate-600 hover:bg-slate-100"
            >
              ×
            </button>
            <p className="details-eyebrow">
              {course.source_code ? `${course.source_code} · ` : ""}
              {course.type === "elective"
                ? "Eletiva"
                : `${course.period}º período`}
            </p>
            <h2 className="text-lg leading-6 font-semibold">
              {courseName(course)}
            </h2>
            <span
              className="status-badge mt-3 inline-block"
              data-status={course.status}
            >
              {statusMeta[course.status].label}
            </span>
            <dl className="details-stats">
              <div>
                <dt>Carga</dt>
                <dd>{course.hours}h</dd>
              </div>
              <div>
                <dt>Créditos</dt>
                <dd>{course.credits ?? "—"}</dd>
              </div>
              <div>
                <dt>Dependentes</dt>
                <dd>{course.dependent_ids.length}</dd>
              </div>
            </dl>
            <div className="details-tabs" role="tablist" aria-label="Seções">
              {tabs.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={tab === key}
                  onClick={() => setTab(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div role="tabpanel" hidden={tab !== "summary"}>
              {course.status === "locked" && (
                <p className="details-note warn">
                  Conclua os pré-requisitos pendentes para liberar esta
                  disciplina.
                </p>
              )}
              {course.status === "planned" && (
                <p className="details-note plan">
                  Planejar não libera pré-requisitos. Simule a aprovação para
                  explorar o impacto.
                </p>
              )}
              {course.critical && (
                <p className="details-note critical">
                  Disciplina crítica: {course.dependent_ids.length} componentes
                  dependem dela, direta ou indiretamente.
                </p>
              )}
              <div className={`mt-4 space-y-2 ${historySlot ? "hidden" : ""}`}>
                {official && (
                  <p className="text-sm text-emerald-800">
                    Aprovação informada · somente leitura
                  </p>
                )}
                {readOnly && !official && readOnlyHint && (
                  <p className="details-note">{readOnlyHint}</p>
                )}
                {readOnly && !official && !readOnlyHint && (
                  <div className="details-note">
                    <p className="text-sm leading-6">
                      Para simular a conclusão desta disciplina, crie ou abra
                      uma alternativa. Depois selecione a disciplina e clique em
                      “Simular aprovação”.
                    </p>
                    <a
                      href="#alternatives"
                      onClick={onClose}
                      className={`${buttonStyle} mt-3 block text-center text-blue-700`}
                    >
                      Criar ou abrir alternativa
                    </a>
                  </div>
                )}
                {!readOnly && (
                  <>
                    {!["completed", "simulated", "locked"].includes(
                      course.status,
                    ) && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onAction("approve")}
                        className={`${buttonStyle} primary-button text-white`}
                      >
                        Simular aprovação
                      </button>
                    )}
                    {allowPlanning &&
                      ["available", "pending"].includes(course.status) && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onAction("plan")}
                          className={buttonStyle}
                        >
                          Planejar para próximo semestre
                        </button>
                      )}
                    {allowPlanning &&
                      (course.status === "planned" || planned) && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onAction("unplan")}
                          className={buttonStyle}
                        >
                          Remover do planejamento
                        </button>
                      )}
                    {(course.status === "simulated" ||
                      (course.status === "completed" && !official)) && (
                      <>
                        <p className="text-xs leading-5 text-slate-600">
                          Desfazer também remove aprovações e planos que
                          dependam desta disciplina.
                        </p>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onAction("revoke")}
                          className={`${buttonStyle} text-amber-800`}
                        >
                          Desfazer aprovação simulada
                        </button>
                      </>
                    )}
                  </>
                )}
                {simulationSlot}
              </div>
              {impactSlot}
              {moveSlot}
            </div>

            {historySlot && (
              <div role="tabpanel" hidden={tab !== "history"}>
                {historySlot}
              </div>
            )}

            <div role="tabpanel" hidden={tab !== "dependencies"}>
              <section className="mt-4">
                <h3 className="details-section-title">Pré-requisitos</h3>
                {course.prerequisite_ids.length ? (
                  references(course.prerequisite_ids)
                ) : (
                  <p className="mt-2 text-xs text-slate-600">
                    {course.prerequisite_status === "unverified"
                      ? "Pré-requisitos ainda não confirmados para esta matriz."
                      : "Nenhum pré-requisito cadastrado."}
                  </p>
                )}
                {course.prerequisite_ids.length > 0 &&
                  course.prerequisite_status === "unverified" && (
                    <p className="mt-2 text-[11px] text-amber-800">
                      Pré-requisitos não confirmados pela coordenação.
                    </p>
                  )}
              </section>
              {(course.corequisite_ids ?? []).length > 0 && (
                <section className="mt-5">
                  <h3 className="details-section-title">Co-requisitos</h3>
                  <p className="mt-1 text-[11px] text-slate-600">
                    Cursar no mesmo semestre ou antes.
                  </p>
                  {references(course.corequisite_ids ?? [])}
                </section>
              )}
              <section className="mt-5">
                <h3 className="details-section-title">Libera diretamente</h3>
                {dependents.length ? (
                  references(dependents)
                ) : (
                  <p className="mt-2 text-xs text-slate-600">
                    Nenhum componente depende diretamente desta disciplina.
                  </p>
                )}
              </section>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
