import { useEffect } from "react";
import type { ActionKind, Course } from "../types";
import { statusMeta } from "./CourseCard";

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
}: {
  course: Course | undefined;
  courses: Course[];
  busy: boolean;
  readOnly?: boolean;
  official?: boolean;
  planned?: boolean;
  onAction: (kind: ActionKind) => void;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
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
        const item = byId.get(id)!;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs hover:bg-slate-100"
          >
            <span
              className={`rounded border px-1.5 py-0.5 ${statusMeta[item.status].style}`}
              aria-label={statusMeta[item.status].label}
            >
              {statusMeta[item.status].icon}
            </span>
            <span>{item.short_name}</span>
          </button>
        );
      })}
    </div>
  );

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
        aria-label="Detalhes da disciplina"
        className={`${course ? "fixed inset-x-0 bottom-0 z-50 max-h-[78dvh] rounded-t-2xl" : "hidden"} overflow-y-auto border border-slate-200 bg-white p-5 shadow-lg lg:sticky lg:top-5 lg:z-auto lg:block lg:max-h-[calc(100dvh-40px)] lg:self-start lg:rounded-xl lg:shadow-sm`}
      >
        {!course ? (
          <div className="py-8">
            <span className="text-3xl text-slate-300" aria-hidden="true">
              ↗
            </span>
            <h2 className="mt-4 text-base font-semibold">
              Explore uma disciplina
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Veja o que ela exige, o que libera e como uma aprovação muda seu
              planejamento.
            </p>
          </div>
        ) : (
          <>
            <button
              type="button"
              aria-label="Fechar detalhes"
              onClick={onClose}
              className="float-right ml-2 rounded px-2 py-1 text-xl text-slate-500 hover:bg-slate-100"
            >
              ×
            </button>
            <p className="mb-2 text-[11px] font-medium tracking-wider text-slate-400 uppercase">
              Detalhes da disciplina
            </p>
            <h2 className="text-lg leading-6 font-semibold">{course.name}</h2>
            <span
              className={`mt-3 inline-block rounded-full border px-2.5 py-1 text-xs ${statusMeta[course.status].style}`}
            >
              {statusMeta[course.status].label}
            </span>
            <dl className="mt-5 grid grid-cols-3 gap-2 border-y border-slate-100 py-4 text-sm">
              <div>
                <dt className="text-[11px] text-slate-500">Período</dt>
                <dd className="mt-1 font-semibold">
                  {course.period ? `${course.period}º` : "Eletiva"}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-slate-500">Carga horária</dt>
                <dd className="mt-1 font-semibold">{course.hours}h</dd>
              </div>
              <div>
                <dt className="text-[11px] text-slate-500">Dependentes</dt>
                <dd className="mt-1 font-semibold">
                  {course.dependent_ids.length}
                </dd>
              </div>
            </dl>
            {course.status === "locked" && (
              <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                Conclua os pré-requisitos pendentes para liberar esta
                disciplina.
              </p>
            )}
            {course.status === "planned" && (
              <p className="mt-4 text-xs leading-5 text-violet-700">
                Planejar não libera pré-requisitos. Simule a aprovação para
                explorar o impacto.
              </p>
            )}
            <section className="mt-5">
              <h3 className="text-xs font-semibold text-slate-600">
                Pré-requisitos
              </h3>
              {course.prerequisite_ids.length ? (
                references(course.prerequisite_ids)
              ) : (
                <p className="mt-2 text-xs text-slate-500">
                  Nenhum pré-requisito cadastrado.
                </p>
              )}
            </section>
            <section className="mt-5">
              <h3 className="text-xs font-semibold text-slate-600">
                Libera diretamente
              </h3>
              {references(
                courses
                  .filter((item) => item.prerequisite_ids.includes(course.id))
                  .map((item) => item.id),
              )}
              {!courses.some((item) =>
                item.prerequisite_ids.includes(course.id),
              ) && (
                <p className="mt-2 text-xs text-slate-500">
                  Nenhum componente depende diretamente desta disciplina.
                </p>
              )}
            </section>
            {course.critical && (
              <p className="mt-5 border-l-2 border-red-300 pl-3 text-xs leading-5 text-slate-600">
                Disciplina crítica: {course.dependent_ids.length} componentes
                dependem dela, direta ou indiretamente.
              </p>
            )}
            <div className="mt-6 space-y-2">
              {official && (
                <p className="text-sm text-emerald-800">
                  Aprovação oficial · somente leitura
                </p>
              )}
              {readOnly && !official && (
                <div className="rounded-lg bg-blue-50 p-3">
                  <p className="text-sm leading-6 text-slate-700">
                    Para simular a conclusão desta disciplina, crie ou abra uma
                    alternativa. Depois selecione a disciplina e clique em
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
                      className={`${buttonStyle} border-blue-700! bg-blue-700! text-white hover:bg-blue-800!`}
                    >
                      Simular aprovação
                    </button>
                  )}
                  {["available", "pending"].includes(course.status) && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onAction("plan")}
                      className={buttonStyle}
                    >
                      Planejar para próximo semestre
                    </button>
                  )}
                  {(course.status === "planned" || planned) && (
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
                      <p className="text-xs leading-5 text-slate-500">
                        Desfazer também remove aprovações e planos que dependam
                        desta disciplina.
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
            </div>
          </>
        )}
      </aside>
    </>
  );
}
