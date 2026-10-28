import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, NavLink, useLocation } from "react-router";
import * as api from "./api";
import type {
  ActionKind,
  HistoryRecord,
  HistoryUpdate,
  Identity,
  Plan,
  Progression,
  Status,
} from "./types";
import DemoApp from "./DemoApp";
import { CurriculumMap } from "./components/CurriculumMap";
import { CourseDetails } from "./components/CourseDetails";
import { HistoryEditor } from "./components/HistoryEditor";
import { PublicExplorer } from "./components/PublicExplorer";
import { ProgressSummary, trackedPercent } from "./components/ProgressSummary";
import { moveCourse } from "./courseLayout";
import { AttemptsEditor } from "./components/AttemptsEditor";
import {
  formatGrade,
  historyLayout,
  termOf,
  termsUntil,
} from "./academicTerms";

const input =
  "glass-input mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";
const button =
  "glass-button rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50";
const primary = `${button} primary-button border-blue-700! bg-blue-700! text-white hover:bg-blue-800!`;
const snapshot = (p: Plan | null) =>
  p &&
  JSON.stringify([
    p.name,
    p.target_term,
    p.planned_ids,
    p.hypothetical_ids,
    Object.entries(p.course_layout ?? {}).sort(([a], [b]) =>
      a.localeCompare(b),
    ),
    Object.entries(p.simulated_grades ?? {}).sort(([a], [b]) =>
      a.localeCompare(b),
    ),
  ]);

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
  if (location.pathname.startsWith("/grades"))
    return <PublicExplorer signedIn={!!identity} />;
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
  if (identity.student && !identity.student.curriculum.available)
    return (
      <PendingProgram
        identity={identity}
        onLogout={() => {
          api.setCsrf("");
          client.clear();
          setIdentity(null);
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

const programNames: Record<"CC" | "SI" | "IA" | "EC", string> = {
  CC: "Ciência da Computação",
  SI: "Sistemas de Informação",
  IA: "Inteligência Artificial",
  EC: "Engenharia da Computação",
};

function PendingProgram({
  identity,
  onLogout,
}: {
  identity: Identity;
  onLogout: () => void;
}) {
  const [failure, setFailure] = useState("");
  const program = identity.student!.program;
  const validFrom = identity.student!.curriculum.valid_from;
  return (
    <div className="app-shell min-h-dvh">
      <header className="app-header flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-5 sm:px-8">
        <div>
          <p className="text-xs text-slate-500">{programNames[program]}</p>
          <h1 className="app-title mt-1 text-xl font-semibold">
            Planejamento Acadêmico Integrado
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-600">{identity.user.email}</span>
          <button
            className={button}
            onClick={() =>
              void api
                .logout()
                .then(onLogout)
                .catch((error) => setFailure(error.message))
            }
          >
            Sair
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-12 sm:px-8">
        {failure && (
          <p role="alert" className="mb-4 text-sm text-red-700">
            {failure}
          </p>
        )}
        <section className="glass-panel rounded-xl p-7 sm:p-10">
          <p className="eyebrow">{programNames[program]}</p>
          <h2 className="mt-3 text-2xl font-semibold">
            {validFrom
              ? `Matriz de ${program} disponível a partir de ${validFrom}`
              : `Grade de ${program} ainda não cadastrada`}
          </h2>
          <p className="mt-3 text-slate-600">
            {validFrom
              ? "Seu semestre de ingresso é anterior à matriz atendida. O planejamento para sua turma ainda não está disponível."
              : "A grade e o planejamento deste curso estarão disponíveis após o cadastro da matriz curricular."}
          </p>
        </section>
      </main>
    </div>
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
  const [confirmPassword, setConfirmPassword] = useState("");
  const [registration, setRegistration] = useState("");
  const [startTerm, setStartTerm] = useState("");
  const [currentPeriod, setCurrentPeriod] = useState("1");
  const [program, setProgram] = useState<"CC" | "SI" | "IA" | "EC">("SI");
  const [registering, setRegistering] = useState(false);
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="login-layout">
      <section className="login-story" aria-label="Sua trajetória acadêmica">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">
            p<span>ai</span>
          </span>
          <span>
            Seu próximo passo,
            <br />
            com mais clareza.
          </span>
        </div>
        <div className="login-headline">
          <p className="eyebrow">SUA TRAJETÓRIA, SUAS POSSIBILIDADES</p>
          <h2>
            Um novo olhar
            <br />
            para o seu <em>futuro.</em>
          </h2>
          <p>
            Conecte o que você já conquistou às possibilidades do próximo
            semestre.
          </p>
        </div>
        <div className="trajectory-art" aria-hidden="true">
          <svg viewBox="0 0 600 240" fill="none">
            <defs>
              <linearGradient id="trajectory" x1="0" y1="240" x2="600" y2="0">
                <stop stopColor="#22a69b" />
                <stop offset="1" stopColor="#5072df" />
              </linearGradient>
            </defs>
            <path
              className="trajectory-shadow"
              d="M20 205 C130 205 90 135 205 135 S310 185 365 95 S475 40 580 25"
            />
            <path
              className="trajectory-line"
              d="M20 205 C130 205 90 135 205 135 S310 185 365 95 S475 40 580 25"
            />
            {[
              [20, 205],
              [205, 135],
              [365, 95],
              [580, 25],
            ].map(([x, y], i) => (
              <g key={x}>
                <circle cx={x} cy={y} r="15" fill="white" />
                <circle
                  cx={x}
                  cy={y}
                  r="6"
                  fill={i === 3 ? "#5072df" : "#22a69b"}
                />
              </g>
            ))}
          </svg>
          <span className="trajectory-note note-start">
            Cada conquista conta
          </span>
          <span className="trajectory-note note-end">
            O próximo passo é seu ↗
          </span>
        </div>
        <p className="login-caption">
          CC <span>·</span> SI <span>·</span> IA <span>·</span> EC
        </p>
      </section>
      <form
        className="login-panel glass-panel"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setFailure("");
          try {
            if (registering) {
              if (password !== confirmPassword) {
                setFailure("As senhas não coincidem.");
                return;
              }
              onLogin(
                await api.register({
                  email,
                  password,
                  registration,
                  start_term: startTerm,
                  current_period: Number(currentPeriod),
                  program,
                }),
              );
            } else {
              onLogin(await api.login(email, password));
            }
            setPassword("");
            setConfirmPassword("");
          } catch (error) {
            setFailure((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <span className="login-badge">PORTAL DO ESTUDANTE</span>
        <h1 className="login-title">Planejamento Acadêmico Integrado</h1>
        <p className="mt-3 text-sm text-slate-600">
          {registering
            ? "Crie sua conta e escolha seu curso para começar."
            : "Acesse seu histórico e suas alternativas para o semestre."}
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
            autoComplete="email"
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
            autoComplete={registering ? "new-password" : "current-password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {registering && (
          <>
            <label className="mt-4 block text-sm">
              Confirmar senha
              <input
                className={input}
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </label>
            <label className="mt-4 block text-sm">
              Matrícula
              <input
                className={input}
                required
                maxLength={80}
                value={registration}
                onChange={(e) => setRegistration(e.target.value)}
              />
            </label>
            <label className="mt-4 block text-sm">
              Semestre de ingresso
              <input
                className={input}
                required
                placeholder="AAAA.1 ou AAAA.2"
                pattern="[0-9]{4}\.[12]"
                value={startTerm}
                onChange={(e) => setStartTerm(e.target.value)}
              />
            </label>
            <label className="mt-4 block text-sm">
              Período atual
              <input
                className={input}
                type="number"
                min="1"
                max="20"
                required
                value={currentPeriod}
                onChange={(e) => setCurrentPeriod(e.target.value)}
              />
            </label>
            <label className="mt-4 block text-sm">
              Curso
              <select
                className={input}
                value={program}
                onChange={(e) => setProgram(e.target.value as typeof program)}
              >
                {Object.entries(programNames).map(([code, name]) => (
                  <option key={code} value={code}>
                    {code} · {name}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        <button className={`${primary} mt-5 w-full`} disabled={busy}>
          {busy
            ? registering
              ? "Cadastrando…"
              : "Entrando…"
            : registering
              ? "Cadastrar"
              : "Entrar"}
        </button>
        <button
          type="button"
          className="mt-4 w-full text-sm font-medium text-blue-700"
          onClick={() => {
            setRegistering(!registering);
            setFailure("");
          }}
        >
          {registering ? "Já tenho conta" : "Criar conta"}
        </button>
        <p className="mt-4 text-xs leading-5 text-slate-500">
          {registering
            ? "Após entrar, informe as cadeiras que você já cursou."
            : "A redefinição de senha é feita pela coordenação."}
        </p>
        <Link
          to="/grades"
          className="mt-3 block text-center text-sm font-medium text-blue-700 underline"
        >
          Explorar as grades sem entrar
        </Link>
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
  const [editingHistory, setEditingHistory] = useState(false);
  const [historyDraft, setHistoryDraft] = useState<HistoryUpdate | null>(null);
  const [preview, setPreview] = useState<Progression | null>(null);
  const location = useLocation();
  // Separação explícita: o que aconteceu (histórico) e o que se imagina (simulação).
  const mode: "history" | "simulation" =
    location.pathname.startsWith("/simulacao") ||
    location.pathname.startsWith("/planejamento")
      ? "simulation"
      : "history";
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
  const planDirty = snapshot(draft) !== snapshot(saved);
  const historyDirty = historyDraft !== null;
  const dirty = planDirty || historyDirty;
  const data =
    mode === "simulation"
      ? (draft ?? progression.data)
      : (preview ?? progression.data);
  const startTerm =
    historyDraft?.start_term ?? history.data?.start_term ?? null;
  const currentPeriod =
    historyDraft?.current_period ?? history.data?.current_period ?? 1;
  const records: HistoryRecord[] =
    historyDraft?.records ?? history.data?.records ?? [];
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
  function editHistory(next: HistoryRecord[]) {
    if (!startTerm) {
      setError(
        "Informe o semestre de ingresso em “Editar histórico” antes de registrar cadeiras no mapa.",
      );
      return;
    }
    const update = {
      start_term: startTerm,
      current_period: currentPeriod,
      records: next,
    };
    setHistoryDraft(update);
    void run(async () => {
      setPreview(await api.previewHistory(update));
    });
  }
  function replaceCourse(courseId: string, next: HistoryRecord[]) {
    editHistory([...records.filter((r) => r.course_id !== courseId), ...next]);
  }
  function moveInHistory(courseId: string, period: number | null) {
    const course = data?.courses.find((c) => c.id === courseId);
    if (!course || course.type !== "elective" || !startTerm || busy) return;
    const own = records
      .filter((r) => r.course_id === courseId)
      .sort((a, b) => a.academic_term.localeCompare(b.academic_term));
    if (period === null) {
      if (
        own.length &&
        !window.confirm("Remover as tentativas desta eletiva do histórico?")
      )
        return;
      replaceCourse(courseId, []);
      setSelectedId(null);
      return;
    }
    const term = termOf(startTerm, period);
    const status = period >= currentPeriod ? "in_progress" : "completed";
    if (own.some((r) => r.academic_term === term)) return;
    if (!own.length) {
      replaceCourse(courseId, [
        { course_id: courseId, academic_term: term, status },
      ]);
    } else {
      const latest = own[own.length - 1];
      replaceCourse(courseId, [
        ...own.slice(0, -1),
        {
          ...latest,
          academic_term: term,
          status:
            status === "in_progress"
              ? "in_progress"
              : latest.status === "in_progress"
                ? "completed"
                : latest.status,
          grade: status === "in_progress" ? null : latest.grade,
        },
      ]);
    }
    setSelectedId(courseId);
    setNotice(
      "Eletiva registrada no histórico. Ajuste situação e nota no painel e clique em Salvar histórico.",
    );
  }
  function setSimulatedGrade(courseId: string, grade: number | null) {
    if (!draft) return;
    const simulated_grades = { ...(draft.simulated_grades ?? {}) };
    if (grade === null) delete simulated_grades[courseId];
    else simulated_grades[courseId] = grade;
    setDraft({ ...draft, simulated_grades });
  }
  async function refreshSimulatedCr() {
    if (!draft) return;
    await run(async () => {
      const result = await api.evaluatePlan(draft.id, {
        version: draft.version,
        history_revision: draft.history_revision,
        planned_ids: draft.planned_ids,
        hypothetical_ids: draft.hypothetical_ids,
        course_layout: draft.course_layout,
        simulated_grades: draft.simulated_grades ?? {},
      });
      setDraft({ ...draft, ...result });
    });
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
        course_layout: draft.course_layout,
        simulated_grades: draft.simulated_grades ?? {},
        action: { kind, course_id: selectedId },
      });
      setDraft({ ...draft, ...result });
      setNotice("Rascunho recalculado. Clique em Salvar para persistir.");
    });
  }
  function move(courseId: string, period: number | null, beforeId?: string) {
    if (!draft || busy) return;
    const course_layout = moveCourse(
      draft.courses,
      draft.course_layout,
      courseId,
      period,
      beforeId,
    );
    if (course_layout === draft.course_layout) return;
    if (period === null && draft.planned_ids.includes(courseId)) {
      void run(async () => {
        const result = await api.evaluatePlan(draft.id, {
          version: draft.version,
          history_revision: draft.history_revision,
          planned_ids: draft.planned_ids,
          hypothetical_ids: draft.hypothetical_ids,
          course_layout,
          action: { kind: "unplan", course_id: courseId },
        });
        setDraft({ ...draft, ...result });
        setNotice(
          "Eletiva devolvida ao catálogo. Clique em Salvar para persistir.",
        );
      });
      return;
    }
    setDraft({ ...draft, course_layout });
    setNotice("Distribuição alterada. Clique em Salvar para persistir.");
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
    <div className="app-shell min-h-dvh">
      <header className="app-header border-b border-slate-200 bg-white px-5 py-5 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs text-slate-500">
              {identity.student
                ? programNames[identity.student.program]
                : "Coordenação"}{" "}
              · CIn/UFPE
            </p>
            <h1 className="app-title mt-1 text-xl font-semibold">
              <span className="brand-dot" aria-hidden="true">
                ↗
              </span>
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
            className="main-nav mt-5 flex gap-5 text-sm"
            aria-label="Navegação principal"
          >
            <NavLink to="/" end>
              Meu histórico
            </NavLink>
            <NavLink to="/simulacao">Simulação</NavLink>
            <NavLink to="/grades">Explorar grades</NavLink>
          </nav>
        )}
      </header>
      <div className="institution-note border-b border-slate-200 px-5 py-2 text-xs text-slate-500 sm:px-8">
        {`Matriz ${identity.student?.curriculum.id ?? ""} transcrita do CIn`}
        {identity.student?.curriculum.source_url?.startsWith("https://") && (
          <>
            {" "}
            ·{" "}
            <a
              href={identity.student.curriculum.source_url}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Consultar fonte
            </a>
          </>
        )}{" "}
        · pré-requisitos conferidos no PPC do curso, sem validação da
        coordenação · o histórico é informado pelo estudante · a matrícula
        oficial continua no SIGAA.
      </div>
      <main className="workspace mx-auto max-w-[1920px] px-4 py-5 sm:px-8">
        {isStudent &&
          data?.warnings.map((warning) => (
            <p key={warning} className="mb-2 text-xs text-amber-800">
              {warning}
            </p>
          ))}
        {isStudent && (
          <section
            className="workspace-intro"
            aria-label="Resumo da trajetória"
          >
            <div>
              <p className="eyebrow">SEU PERCURSO ACADÊMICO</p>
              <h2>
                Planeje possibilidades.
                <br />
                <span>Construa sua trajetória.</span>
              </h2>
              <p>
                Explore a grade, conecte disciplinas e prepare seu próximo
                semestre.
              </p>
            </div>
            <div
              className="progress-orbit"
              style={
                {
                  "--progress": `${trackedPercent(data?.integralization)}%`,
                } as React.CSSProperties
              }
            >
              <div>
                <strong>
                  {trackedPercent(data?.integralization)}
                  <small>%</small>
                </strong>
                <span>da carga acompanhada</span>
              </div>
            </div>
          </section>
        )}
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
                <h2 className="font-semibold">Nenhuma cadeira registrada</h2>
                <p className="mt-1 text-sm">
                  Informe as cadeiras que já cursou para atualizar seu mapa.
                </p>
              </section>
            )}
            {history.data && progression.data && (
              <section className="mb-5">
                {!editingHistory ? (
                  <button
                    className={button}
                    onClick={() => {
                      if (discard()) setEditingHistory(true);
                    }}
                  >
                    Editar histórico
                  </button>
                ) : (
                  <HistoryEditor
                    history={history.data}
                    courses={progression.data.courses}
                    onCancel={() => setEditingHistory(false)}
                    onReadTranscript={api.readTranscript}
                    onSave={async (payload) => {
                      await api.saveHistory(payload);
                      open(null);
                      await Promise.all([
                        history.refetch(),
                        progression.refetch(),
                        plans.refetch(),
                      ]);
                      setEditingHistory(false);
                      setNotice("Histórico salvo.");
                    }}
                  />
                )}
              </section>
            )}
            <section
              id="alternatives"
              className="alternatives-panel glass-panel mb-5 scroll-mt-5 rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-semibold">
                  {mode === "history"
                    ? "Histórico informado"
                    : draft
                      ? "Cenário hipotético"
                      : "Simulação"}
                </h2>
                <span className="text-xs text-slate-500">
                  Revisão {data?.history_revision ?? "—"} ·{" "}
                  {data?.current_period ?? "—"}º período
                </span>
              </div>
              {history.data?.import && (
                <p className="mt-2 text-xs text-slate-500">
                  Atualizado em{" "}
                  {new Date(history.data.import.created_at).toLocaleString(
                    "pt-BR",
                  )}{" "}
                  · {history.data.import.source}
                  {history.data.import.source !==
                    "Informado pelo estudante" && (
                    <> · referência {history.data.import.source_reference}</>
                  )}
                </p>
              )}
              {history.data?.warnings.map((warning, i) => (
                <p key={i} className="mt-2 text-xs text-amber-800">
                  {warning.course_id} ({warning.academic_term}):{" "}
                  {warning.message}
                </p>
              ))}
              {mode === "history" && (
                <div className="history-mode mt-4">
                  <p className="text-sm text-slate-600">
                    Este é o que <strong>já aconteceu</strong>. Clique numa
                    disciplina do mapa para registrar aprovação, reprovação e
                    nota, ou arraste eletivas do catálogo para os períodos já
                    cursados. Para testar cenários, use a aba{" "}
                    <NavLink
                      to="/simulacao"
                      className="font-medium text-blue-700 underline"
                    >
                      Simulação
                    </NavLink>
                    .
                  </p>
                  {historyDirty && (
                    <div
                      className="history-save-bar mt-4"
                      role="region"
                      aria-label="Alterações no histórico"
                    >
                      <p className="text-sm text-violet-800">
                        Alterações no histórico ainda não salvas.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          className={primary}
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              await api.saveHistory(historyDraft!);
                              setHistoryDraft(null);
                              setPreview(null);
                              open(null);
                              await Promise.all([
                                history.refetch(),
                                progression.refetch(),
                                plans.refetch(),
                              ]);
                              setNotice("Histórico salvo.");
                            })
                          }
                        >
                          Salvar histórico
                        </button>
                        <button
                          className={button}
                          disabled={busy}
                          onClick={() => {
                            setHistoryDraft(null);
                            setPreview(null);
                          }}
                        >
                          Descartar alterações
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {mode === "simulation" && (
                <>
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
                      <option value="">Histórico informado</option>
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
                              setDraft({
                                ...draft,
                                target_term: e.target.value,
                              });
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
                        {dirty ? "Alterações pendentes" : "Versão salva"} ·
                        somente aprovações simuladas liberam dependentes neste
                        cenário. Planejar ou estar em andamento não libera
                        pré-requisitos.
                      </p>
                      {!draft.valid && (
                        <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                          <p>
                            Este plano precisa de ajustes antes de salvar. Suas
                            escolhas foram preservadas.
                          </p>
                          {Object.entries(draft.problems).map(
                            ([id, issues]) => (
                              <div key={id} className="mt-2">
                                <span>
                                  {data?.courses.find((c) => c.id === id)?.name}
                                  : {issues.join(" ")}
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
                                          history_revision:
                                            draft.history_revision,
                                          course_layout: draft.course_layout,
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
                            ),
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </section>
            <div className="metrics-grid mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {[
                ["Aprovações oficiais", data?.counts.completed],
                ["Aprovações simuladas", data?.counts.simulated],
                ["Em andamento", data?.counts.in_progress],
                ["Carga planejada", `${data?.planned_hours ?? 0}h`],
                mode === "simulation" &&
                draft?.cr?.simulated_value !== null &&
                draft?.cr?.simulated_value !== undefined
                  ? ["CR simulado", formatGrade(draft.cr.simulated_value)]
                  : [
                      data?.cr?.ungraded_attempts
                        ? `CR · ${data.cr.ungraded_attempts} sem nota`
                        : "CR",
                      formatGrade(data?.cr?.value),
                    ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="metric-card rounded-lg border border-slate-200 bg-white p-4"
                >
                  <p className="text-2xl font-semibold">{value ?? "—"}</p>
                  <p className="mt-1 text-xs text-slate-500">{label}</p>
                </div>
              ))}
            </div>
            {data && (
              <ProgressSummary
                integralization={data.integralization}
                forecast={data.forecast}
                courses={data.courses}
                onSelect={setSelectedId}
              />
            )}
            <div className="filter-bar mb-5 flex flex-wrap gap-3">
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
                    ["completed", "Aprovação informada"],
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
                {mode === "history" ? (
                  <CurriculumMap
                    key="history"
                    courses={visible}
                    allCourses={data.courses}
                    layout={
                      startTerm
                        ? historyLayout(data.courses, records, startTerm)
                        : {}
                    }
                    editable={!!startTerm && !busy}
                    canMove={(course) => course.type === "elective"}
                    maxPeriod={currentPeriod}
                    editHint="Clique numa disciplina para registrar a situação. Arraste eletivas para os períodos já cursados."
                    needsInfo={(course) =>
                      course.type === "mandatory" &&
                      course.period === 1 &&
                      currentPeriod > 1 &&
                      !records.some((r) => r.course_id === course.id)
                    }
                    onMove={(id, period) => moveInHistory(id, period)}
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
                ) : (
                  <CurriculumMap
                    key={draft?.id ?? "official"}
                    courses={visible}
                    allCourses={data.courses}
                    layout={draft?.course_layout}
                    editable={!!draft && !busy}
                    onMove={move}
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
                )}
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
                  historySlot={
                    mode === "history" && selected ? (
                      startTerm ? (
                        <AttemptsEditor
                          key={selected.id}
                          course={selected}
                          records={records.filter(
                            (r) => r.course_id === selected.id,
                          )}
                          terms={termsUntil(startTerm, currentPeriod)}
                          defaultTerm={termOf(
                            startTerm,
                            Math.max(
                              1,
                              Math.min(
                                selected.period ?? currentPeriod - 1,
                                currentPeriod,
                              ),
                            ),
                          )}
                          firstPeriodRequired={
                            selected.type === "mandatory" &&
                            selected.period === 1 &&
                            currentPeriod > 1
                          }
                          failureLimit={data.failure_limit ?? 3}
                          failureRule={
                            data.failure_rule ?? "Res. nº 09/2009-CCEPE/UFPE"
                          }
                          onChange={(next) => replaceCourse(selected.id, next)}
                        />
                      ) : (
                        <p className="mt-5 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
                          Informe seu semestre de ingresso em “Editar histórico”
                          para registrar cadeiras no mapa.
                        </p>
                      )
                    ) : undefined
                  }
                  simulationSlot={
                    mode === "simulation" &&
                    draft &&
                    selected &&
                    (draft.planned_ids.includes(selected.id) ||
                      draft.hypothetical_ids.includes(selected.id)) ? (
                      <label className="mt-3 block text-xs text-slate-600">
                        Nota simulada (entra no CR simulado)
                        <input
                          className={input}
                          type="number"
                          min="0"
                          max="10"
                          step="0.1"
                          inputMode="decimal"
                          disabled={busy}
                          value={draft.simulated_grades?.[selected.id] ?? ""}
                          onChange={(e) => {
                            const value = e.target.value.replace(",", ".");
                            const grade = value === "" ? null : Number(value);
                            if (grade === null || (grade >= 0 && grade <= 10))
                              setSimulatedGrade(selected.id, grade);
                          }}
                          onBlur={() => void refreshSimulatedCr()}
                        />
                      </label>
                    ) : undefined
                  }
                />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
