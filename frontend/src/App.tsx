import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NavLink, useLocation } from "react-router";
import { getScenarios, simulate } from "./api";
import type { ActionKind, Status, Simulation } from "./types";
import { CourseCard } from "./components/CourseCard";
import { CourseDetails } from "./components/CourseDetails";
import { CurriculumMap } from "./components/CurriculumMap";

const filters: { id: Status | "all" | "elective"; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "completed", label: "Concluídas" },
  { id: "available", label: "Disponíveis" },
  { id: "planned", label: "Planejadas" },
  { id: "pending", label: "Pendentes" },
  { id: "locked", label: "Bloqueadas" },
  { id: "elective", label: "Eletivas" },
];

export default function App() {
  const client = useQueryClient();
  const [scenarioId, setScenarioId] = useState("padrao");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const isPlan = useLocation().pathname === "/planejamento";
  const scenarios = useQuery({
    queryKey: ["scenarios"],
    queryFn: getScenarios,
  });
  const scenario = scenarios.data?.find((item) => item.id === scenarioId);
  const key = ["simulation", scenarioId];
  const simulation = useQuery({
    queryKey: key,
    queryFn: () =>
      simulate({
        current_period: scenario!.current_period,
        completed_ids: scenario!.completed_ids,
        planned_ids: scenario!.planned_ids,
      }),
    enabled: !!scenario,
    staleTime: Infinity,
  });
  const data = simulation.data;
  const mutation = useMutation({
    mutationFn: (kind: ActionKind) =>
      simulate({
        current_period: data!.current_period,
        completed_ids: data!.completed_ids,
        planned_ids: data!.planned_ids,
        action: { kind, course_id: selectedId! },
      }),
    onSuccess: (result, kind) => {
      client.setQueryData<Simulation>(key, result);
      setNotice(
        {
          approve: "Aprovação simulada. Os pré-requisitos foram recalculados.",
          plan: "Disciplina adicionada ao plano do próximo semestre.",
          unplan: "Disciplina removida do plano.",
          revoke:
            "Aprovação desfeita. Os componentes dependentes foram recalculados.",
        }[kind],
      );
    },
  });
  const busy = mutation.isPending || simulation.isFetching;
  const selected = data?.courses.find((course) => course.id === selectedId);
  const related = new Set(
    selected
      ? [...selected.prerequisite_ids, ...selected.dependent_ids]
      : (scenario?.trail_ids ?? []),
  );
  const visible =
    data?.courses.filter(
      (course) =>
        (filter === "all" ||
          (filter === "elective"
            ? course.type === "elective"
            : course.status === filter)) &&
        course.name
          .toLocaleLowerCase("pt-BR")
          .includes(search.toLocaleLowerCase("pt-BR")),
    ) ?? [];
  const error = scenarios.error || simulation.error;
  function reset() {
    setSelectedId(null);
    setFilter("all");
    setSearch("");
    mutation.reset();
    setNotice("Cenário restaurado ao estado inicial.");
    void simulation.refetch();
  }
  function changeScenario(id: string) {
    client.removeQueries({ queryKey: ["simulation", id], exact: true });
    setScenarioId(id);
    setSelectedId(null);
    setFilter("all");
    setSearch("");
    setNotice("");
    mutation.reset();
  }

  return (
    <div className="min-h-dvh font-sans">
      <header className="border-b border-slate-200 bg-white px-5 py-5 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="mb-1 text-[11px] font-medium tracking-widest text-slate-500 uppercase">
              Sistemas de Informação · CIn/UFPE
            </p>
            <h1 className="text-xl font-semibold tracking-tight">
              Planejamento Acadêmico Integrado
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Explore possibilidades antes da matrícula.
            </p>
          </div>
          <div className="flex gap-5 text-sm">
            <div>
              <p className="text-[11px] text-slate-500">Perfil</p>
              <p className="mt-1 font-medium">Demonstração</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500">Período atual</p>
              <p className="mt-1 font-medium">
                {data?.current_period ?? "—"}º período
              </p>
            </div>
          </div>
        </div>
        <nav
          aria-label="Navegação principal"
          className="mt-5 flex gap-5 text-sm"
        >
          {[
            ["/", "Mapa curricular"],
            ["/planejamento", "Plano do semestre"],
          ].map(([path, label]) => (
            <NavLink
              key={path}
              to={path}
              end
              className={({ isActive }) =>
                `border-b-2 pb-2 ${isActive ? "border-blue-700 font-semibold text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"}`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-2 text-[11px] text-slate-500 sm:px-8">
        Dados demonstrativos · a matrícula oficial continua no SIGAA ·
        alterações desta sessão não são salvas.
      </div>
      <main className="mx-auto max-w-[1920px] px-4 py-5 sm:px-8 sm:py-6">
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Concluídas", data?.counts.completed, "text-emerald-700"],
            ["Pendentes", data?.counts.pending, "text-amber-700"],
            ["Disponíveis", data?.counts.available, "text-blue-700"],
            ["Planejadas", data?.counts.planned, "text-violet-700"],
          ].map(([label, value, color]) => (
            <div
              key={label}
              className="rounded-lg border border-slate-200 bg-white px-4 py-3"
            >
              <p className={`text-2xl font-semibold ${color}`}>
                {value ?? "—"}
              </p>
              <p className="mt-1 text-xs text-slate-500">{label}</p>
            </div>
          ))}
        </div>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-slate-500">
              Cenário demonstrativo
              <select
                aria-label="Cenário demonstrativo"
                value={scenarioId}
                disabled={busy || !scenarios.data}
                onChange={(event) => changeScenario(event.target.value)}
                className="mt-1 block max-w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
              >
                {scenarios.data?.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={busy || !data}
              onClick={reset}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
            >
              Restaurar cenário
            </button>
          </div>
          {!isPlan && (
            <label className="w-full text-xs text-slate-500 sm:w-auto">
              Buscar disciplina
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nome da disciplina"
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 sm:w-64"
              />
            </label>
          )}
        </div>
        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-5"
          >
            <p className="text-sm text-red-800">{error.message}</p>
            <button
              type="button"
              className="mt-3 rounded border border-red-300 bg-white px-3 py-2 text-sm"
              onClick={() => {
                void scenarios.refetch();
                if (scenario) void simulation.refetch();
              }}
            >
              Tentar novamente
            </button>
          </div>
        ) : !data ? (
          <div
            role="status"
            className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500"
          >
            Carregando sua trajetória…
          </div>
        ) : (
          <>
            {data.warnings.map((warning) => (
              <p
                key={warning}
                className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800"
              >
                {warning}
              </p>
            ))}
            {mutation.error && (
              <p
                role="alert"
                className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-800"
              >
                {mutation.error.message}
              </p>
            )}
            <p
              role="status"
              aria-live="polite"
              className="mb-3 min-h-5 text-xs text-blue-800"
            >
              {busy ? "Atualizando a simulação…" : notice}
            </p>
            {!isPlan && (
              <div
                role="group"
                aria-label="Filtrar disciplinas"
                className="mb-5 flex flex-wrap gap-2"
              >
                {filters.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={filter === item.id}
                    onClick={() => setFilter(item.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs ${filter === item.id ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-600 hover:border-slate-500"}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
            <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
              {isPlan ? (
                <section>
                  <div className="mb-5 flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold">
                        Plano do próximo semestre
                      </h2>
                      <p className="mt-1 text-xs text-slate-500">
                        Disciplinas escolhidas nesta sessão.
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        data-testid="planned-hours"
                        className="text-2xl font-semibold text-violet-700"
                      >
                        {data.planned_hours}h
                      </p>
                      <p className="text-[11px] text-slate-500">
                        carga planejada
                      </p>
                    </div>
                  </div>
                  {data.planned_ids.length ? (
                    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                      {data.courses
                        .filter((course) => course.status === "planned")
                        .map((course) => (
                          <CourseCard
                            key={course.id}
                            course={course}
                            selected={course.id === selectedId}
                            related={false}
                            onSelect={() => setSelectedId(course.id)}
                          />
                        ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-300 p-8">
                      <h3 className="font-semibold">Seu plano está vazio</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        No mapa curricular, selecione uma disciplina elegível e
                        escolha “Planejar para próximo semestre”.
                      </p>
                    </div>
                  )}
                </section>
              ) : (
                <CurriculumMap
                  courses={visible}
                  selectedId={selectedId}
                  relatedIds={related}
                  onSelect={setSelectedId}
                />
              )}
              <CourseDetails
                course={selected}
                courses={data.courses}
                busy={busy}
                onAction={(kind) => mutation.mutate(kind)}
                onSelect={setSelectedId}
                onClose={() => setSelectedId(null)}
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
