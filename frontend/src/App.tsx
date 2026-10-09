import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { NavLink, useLocation } from "react-router";
import * as api from "./api";
import type { ActionKind, Identity, Plan, Status } from "./types";
import DemoApp from "./DemoApp";
import { CurriculumMap } from "./components/CurriculumMap";
import { CourseDetails } from "./components/CourseDetails";

const input =
  "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";
const button =
  "rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50";
const primary = `${button} border-blue-700! bg-blue-700! text-white hover:bg-blue-800!`;
const snapshot = (p: Plan | null) =>
  p &&
  JSON.stringify([p.name, p.target_term, p.planned_ids, p.hypothetical_ids]);

export default function App() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const client = useQueryClient();
  const location = useLocation();
  useEffect(() => {
    let active = true;
    api
      .getMe()
      .then((result) => {
        if (active) {
          api.setCsrf(result.csrf_token);
          setIdentity(result);
        }
      })
      .catch((error) => {
        if (active && !(error instanceof api.ApiError && error.status === 401))
          setError(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    const expire = () => {
      api.setCsrf("");
      client.clear();
      setIdentity(null);
      setError("Sessão expirada. Entre novamente.");
    };
    window.addEventListener("session-expired", expire);
    return () => {
      active = false;
      window.removeEventListener("session-expired", expire);
    };
  }, [client]);
  if (
    location.pathname.startsWith("/demo") &&
    import.meta.env.VITE_DEMO_ENABLED === "true"
  )
    return <DemoApp />;
  if (loading)
    return (
      <p className="p-8" role="status">
        Carregando sessão…
      </p>
    );
  if (!identity)
    return (
      <Login
        error={error}
        onLogin={(result) => {
          client.clear();
          api.setCsrf(result.csrf_token);
          setIdentity(result);
          setError("");
        }}
      />
    );
  return (
    <Student
      key={identity.user.id}
      identity={identity}
      onLogout={() => {
        api.setCsrf("");
        client.clear();
        setIdentity(null);
        setError("");
      }}
    />
  );
}

function Login({
  error,
  onLogin,
}: {
  error: string;
  onLogin: (value: Identity) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="mx-auto flex min-h-dvh max-w-md items-center px-5">
      <form
        className="w-full rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setFailure("");
          try {
            onLogin(await api.login(email, password));
            setPassword("");
          } catch (error) {
            setFailure((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <p className="text-xs text-slate-500">
          Sistemas de Informação · CIn/UFPE
        </p>
        <h1 className="mt-2 text-xl font-semibold">
          Planejamento Acadêmico Integrado
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          Acesse seu histórico e suas alternativas para o semestre.
        </p>
        {(failure || error) && (
          <p role="alert" className="mt-4 text-sm text-red-700">
            {failure || error}
          </p>
        )}
        <label className="mt-6 block text-sm">
          E-mail
          <input
            className={input}
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="mt-4 block text-sm">
          Senha
          <input
            className={input}
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button className={`${primary} mt-5 w-full`} disabled={busy}>
          Entrar
        </button>
        <p className="mt-4 text-xs leading-5 text-slate-500">
          Contas e redefinição de senha são fornecidas pela coordenação.
        </p>
      </form>
    </main>
  );
}

function Student({
  identity,
  onLogout,
}: {
  identity: Identity;
  onLogout: () => void;
}) {
  const client = useQueryClient();
  const [draft, setDraft] = useState<Plan | null>(null);
  const [saved, setSaved] = useState<Plan | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newTerm, setNewTerm] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Status | "all">("all");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const isStudent = identity.user.role === "student";
  const history = useQuery({
    queryKey: ["history"],
    queryFn: api.getHistory,
    enabled: isStudent,
  });
  const progression = useQuery({
    queryKey: ["progression"],
    queryFn: api.getProgression,
    enabled: isStudent,
  });
  const plans = useQuery({
    queryKey: ["plans"],
    queryFn: api.getPlans,
    enabled: isStudent,
  });
  const dirty = snapshot(draft) !== snapshot(saved);
  const data = draft ?? progression.data;
  const selected = data?.courses.find((c) => c.id === selectedId);
  const failure =
    error ||
    history.error?.message ||
    progression.error?.message ||
    plans.error?.message;
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", unload);
    return () => window.removeEventListener("beforeunload", unload);
  }, [dirty]);
  const discard = () =>
    !dirty || window.confirm("Há alterações pendentes. Deseja descartá-las?");
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function open(plan: Plan | null) {
    setDraft(plan);
    setSaved(plan);
    setSelectedId(null);
  }
  async function refresh() {
    if (!discard()) return;
    await run(async () => {
      if (draft) open(await api.getPlan(draft.id));
      await Promise.all([
        history.refetch(),
        progression.refetch(),
        plans.refetch(),
      ]);
    });
  }
  async function action(kind: ActionKind) {
    if (!draft || !selectedId) return;
    await run(async () => {
      const result = await api.evaluatePlan(draft.id, {
        version: draft.version,
        history_revision: draft.history_revision,
        planned_ids: draft.planned_ids,
        hypothetical_ids: draft.hypothetical_ids,
        action: { kind, course_id: selectedId },
      });
      setDraft({ ...draft, ...result });
      setNotice("Rascunho recalculado. Clique em Salvar para persistir.");
    });
  }
  const visible =
    data?.courses.filter(
      (c) =>
        (filter === "all" || c.status === filter) &&
        c.name
          .toLocaleLowerCase("pt-BR")
          .includes(search.toLocaleLowerCase("pt-BR")),
    ) ?? [];
  return (
    <div className="min-h-dvh">
      <header className="border-b border-slate-200 bg-white px-5 py-5 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs text-slate-500">
              Sistemas de Informação · CIn/UFPE
            </p>
            <h1 className="mt-1 text-xl font-semibold">
              Planejamento Acadêmico Integrado
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <span className="break-all text-sm text-slate-600">
              {identity.user.email}
            </span>
            <button
              className={button}
              disabled={busy}
              onClick={() => {
                if (discard())
                  void run(async () => {
                    await api.logout();
                    onLogout();
                  });
              }}
            >
              Sair
            </button>
          </div>
        </div>
        {isStudent && (
          <nav
            className="mt-5 flex gap-5 text-sm"
            aria-label="Navegação principal"
          >
            <NavLink to="/">Mapa curricular</NavLink>
            <NavLink to="/planejamento">Alternativas do semestre</NavLink>
          </nav>
        )}
      </header>
      <div className="border-b border-slate-200 px-5 py-2 text-xs text-slate-500 sm:px-8">
        Grade demonstrativa, pendente de validação institucional · a matrícula
        oficial continua no SIGAA · a validação considera apenas pré-requisitos.
      </div>
      <main className="mx-auto max-w-[1920px] px-4 py-5 sm:px-8">
        {failure && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
            <p role="alert" className="text-sm text-red-800">
              {failure}
            </p>
            <button
              className={`${button} mt-3`}
              disabled={busy}
              onClick={() => void refresh()}
            >
              Recarregar dados
            </button>
          </div>
        )}
        {notice && (
          <p role="status" className="mb-4 text-sm text-blue-800">
            {notice}
          </p>
        )}
        {!isStudent ? (
          <p>
            Conta da coordenação. A importação de histórico está disponível nos
            endpoints documentados da API.
          </p>
        ) : (
          <>
            {history.isLoading && <p role="status">Carregando histórico…</p>}
            {history.data?.awaiting_import && (
              <section className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <h2 className="font-semibold">
                  Aguardando importação do histórico
                </h2>
                <p className="mt-1 text-sm">
                  Ainda não há registros acadêmicos. Aguarde a importação da
                  coordenação. O mapa não contém aprovações oficiais.
                </p>
              </section>
            )}
            <section
              id="alternatives"
              className="mb-5 scroll-mt-5 rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-semibold">
                  {draft ? "Cenário hipotético" : "Histórico oficial"}
                </h2>
                <span className="text-xs text-slate-500">
                  Revisão {data?.history_revision ?? "—"} ·{" "}
                  {data?.current_period ?? "—"}º período
                </span>
              </div>
              {history.data?.import && (
                <p className="mt-2 text-xs text-slate-500">
                  Importado pela coordenação em{" "}
                  {new Date(history.data.import.created_at).toLocaleString(
                    "pt-BR",
                  )}{" "}
                  · {history.data.import.source} · referência{" "}
                  {history.data.import.source_reference}
                </p>
              )}
              {history.data?.warnings.map((warning, i) => (
                <p key={i} className="mt-2 text-xs text-amber-800">
                  {warning.course_id} ({warning.academic_term}):{" "}
                  {warning.message}
                </p>
              ))}
              <label className="mt-4 block max-w-lg text-xs text-slate-600">
                Alternativa salva
                <select
                  className={input}
                  value={draft?.id ?? ""}
                  disabled={busy || plans.isLoading}
                  onChange={(e) => {
                    const id = e.target.value;
                    if (!discard()) return;
                    void run(async () =>
                      open(id ? await api.getPlan(id) : null),
                    );
                  }}
                >
                  <option value="">Histórico oficial</option>
                  {plans.data?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.target_term}
                    </option>
                  ))}
                </select>
              </label>
              <form
                className="mt-4 flex flex-wrap items-end gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!discard()) return;
                  void run(async () => {
                    open(await api.createPlan(newName, newTerm));
                    setNewName("");
                    await plans.refetch();
                  });
                }}
              >
                <label className="min-w-0 text-xs text-slate-600">
                  Nome da alternativa
                  <input
                    className={input}
                    required
                    maxLength={120}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </label>
                <label className="text-xs text-slate-600">
                  Semestre-alvo
                  <input
                    className={input}
                    required
                    pattern="[0-9]{4}\.[12]"
                    placeholder="2026.2"
                    value={newTerm}
                    onChange={(e) => setNewTerm(e.target.value)}
                  />
                </label>
                <button className={button} disabled={busy}>
                  Criar alternativa
                </button>
              </form>
              {draft && (
                <div className="mt-5 border-t border-slate-200 pt-4">
                  <div className="flex flex-wrap items-end gap-3">
                    <label className="text-xs text-slate-600">
                      Nome do plano
                      <input
                        className={input}
                        maxLength={120}
                        value={draft.name}
                        disabled={busy}
                        onChange={(e) => {
                          setNotice("");
                          setDraft({ ...draft, name: e.target.value });
                        }}
                      />
                    </label>
                    <label className="text-xs text-slate-600">
                      Semestre do plano
                      <input
                        className={input}
                        value={draft.target_term}
                        disabled={busy}
                        onChange={(e) => {
                          setNotice("");
                          setDraft({ ...draft, target_term: e.target.value });
                        }}
                      />
                    </label>
                    <button
                      className={primary}
                      disabled={
                        busy ||
                        !dirty ||
                        !draft.valid ||
                        !draft.name.trim() ||
                        !/^\d{4}\.[12]$/.test(draft.target_term)
                      }
                      onClick={() =>
                        void run(async () => {
                          open(await api.savePlan(draft));
                          await plans.refetch();
                          setNotice(
                            "Plano salvo. Suas escolhas estão persistidas.",
                          );
                        })
                      }
                    >
                      Salvar
                    </button>
                    <button
                      className={button}
                      disabled={busy}
                      onClick={() => void refresh()}
                    >
                      Recarregar plano
                    </button>
                    <button
                      className={`${button} text-red-700`}
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            "Excluir esta alternativa e seu rascunho?",
                          )
                        )
                          void run(async () => {
                            await api.deletePlan(draft.id, draft.version);
                            open(null);
                            await plans.refetch();
                            setNotice("Plano excluído.");
                          });
                      }}
                    >
                      Excluir alternativa
                    </button>
                  </div>
                  <p className="mt-3 text-sm text-violet-800">
                    {dirty ? "Alterações pendentes" : "Versão salva"} · somente
                    aprovações simuladas liberam dependentes neste cenário.
                    Planejar ou estar em andamento não libera pré-requisitos.
                  </p>
                  {!draft.valid && (
                    <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                      <p>
                        Este plano precisa de ajustes antes de salvar. Suas
                        escolhas foram preservadas.
                      </p>
                      {Object.entries(draft.problems).map(([id, issues]) => (
                        <div key={id} className="mt-2">
                          <span>
                            {data?.courses.find((c) => c.id === id)?.name}:{" "}
                            {issues.join(" ")}
                          </span>
                          <button
                            className={`${button} ml-2 mt-1`}
                            disabled={busy}
                            onClick={() =>
                              void run(async () => {
                                const result = await api.evaluatePlan(
                                  draft.id,
                                  {
                                    version: draft.version,
                                    history_revision: draft.history_revision,
                                    planned_ids: draft.planned_ids.filter(
                                      (x) => x !== id,
                                    ),
                                    hypothetical_ids:
                                      draft.hypothetical_ids.filter(
                                        (x) => x !== id,
                                      ),
                                  },
                                );
                                setDraft({ ...draft, ...result });
                              })
                            }
                          >
                            Remover escolha
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Aprovações oficiais", data?.counts.completed],
                ["Aprovações simuladas", data?.counts.simulated],
                ["Em andamento", data?.counts.in_progress],
                ["Carga planejada", `${data?.planned_hours ?? 0}h`],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-lg border border-slate-200 bg-white p-4"
                >
                  <p className="text-2xl font-semibold">{value ?? "—"}</p>
                  <p className="mt-1 text-xs text-slate-500">{label}</p>
                </div>
              ))}
            </div>
            <div className="mb-5 flex flex-wrap gap-3">
              <label className="text-xs">
                Buscar disciplina
                <input
                  className={input}
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <label className="text-xs">
                Estado acadêmico
                <select
                  className={input}
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as Status | "all")}
                >
                  {[
                    ["all", "Todas"],
                    ["completed", "Aprovação oficial"],
                    ["simulated", "Aprovação simulada"],
                    ["in_progress", "Em andamento"],
                    ["planned", "Planejadas"],
                    ["available", "Disponíveis"],
                    ["pending", "Pendentes"],
                    ["locked", "Bloqueadas"],
                  ].map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {data && (
              <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
                <CurriculumMap
                  courses={visible}
                  selectedId={selectedId}
                  relatedIds={
                    new Set(
                      selected
                        ? [
                            ...selected.prerequisite_ids,
                            ...selected.dependent_ids,
                          ]
                        : [],
                    )
                  }
                  onSelect={setSelectedId}
                />
                <CourseDetails
                  course={selected}
                  courses={data.courses}
                  busy={busy}
                  onAction={(kind) => void action(kind)}
                  onSelect={setSelectedId}
                  onClose={() => setSelectedId(null)}
                  readOnly={!draft || selected?.status === "completed"}
                  official={selected?.status === "completed"}
                  planned={draft?.planned_ids.includes(selectedId ?? "")}
                />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
