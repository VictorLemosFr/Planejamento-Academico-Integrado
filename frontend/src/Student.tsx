import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  NavLink,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router";
import { BookOpen, Download, FilePlus2 } from "lucide-react";
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
import { CurriculumMap } from "./components/CurriculumMap";
import { CourseDetails } from "./components/CourseDetails";
import { HistoryEditor } from "./components/HistoryEditor";
import { ProgressSummary } from "./components/ProgressSummary";
import { KpiStrip } from "./components/KpiStrip";
import { AttemptsEditor } from "./components/AttemptsEditor";
import { AppShell, studentNav } from "./components/AppShell";
import type { Command } from "./components/CommandPalette";
import { FailureImpactPanel } from "./components/FailureImpactPanel";
import { SharePanel } from "./components/SharePanel";
import { PrintReport } from "./components/PrintReport";
import { statusMeta } from "./components/CourseCard";
import { Overview } from "./pages/Overview";
import { NextSemester } from "./pages/NextSemester";
import { ComparePlans } from "./pages/ComparePlans";
import { coursePeriod, moveCourse } from "./courseLayout";
import { courseName } from "./display";
import {
  formatGrade,
  historyLayout,
  periodOf,
  termOf,
  termsUntil,
} from "./academicTerms";
import { trackedPercent } from "./components/ProgressSummary";

const input =
  "glass-input mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";
const button =
  "glass-button rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50";
const primary = `${button} primary-button`;
export const programNames: Record<"CC" | "SI" | "IA" | "EC", string> = {
  CC: "Ciência da Computação",
  SI: "Sistemas de Informação",
  IA: "Inteligência Artificial",
  EC: "Engenharia da Computação",
};
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

type Page = "overview" | "history" | "simulation" | "next" | "compare";
const titles: Record<Page, string> = {
  overview: "Visão geral",
  history: "Meu histórico",
  simulation: "Simulação",
  next: "Próximo semestre",
  compare: "Comparar alternativas",
};
function pageOf(pathname: string): Page {
  if (pathname.startsWith("/historico")) return "history";
  if (pathname.startsWith("/simulacao") || pathname.startsWith("/planejamento"))
    return "simulation";
  if (pathname.startsWith("/proximo-semestre")) return "next";
  if (pathname.startsWith("/comparar")) return "compare";
  return "overview";
}
/** Semestre corrente pelo calendário, quando não há semestre de ingresso. */
function calendarTerm(offset = 0) {
  const now = new Date();
  const index = now.getFullYear() * 2 + (now.getMonth() < 6 ? 0 : 1) + offset;
  return `${Math.floor(index / 2)}.${(index % 2) + 1}`;
}

export function Student({
  identity,
  onLogout,
}: {
  identity: Identity;
  onLogout: () => void;
}) {
  const [draft, setDraft] = useState<Plan | null>(null);
  const [saved, setSaved] = useState<Plan | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newTerm, setNewTerm] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Status | "all" | "critical">("all");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingHistory, setEditingHistory] = useState(false);
  const [historyDraft, setHistoryDraft] = useState<HistoryUpdate | null>(null);
  const [preview, setPreview] = useState<Progression | null>(null);
  const [scrollTo, setScrollTo] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const page = pageOf(location.pathname);
  // Separação explícita: o que aconteceu (histórico) e o que se imagina (simulação).
  const mode: "history" | "simulation" =
    page === "simulation" ? "simulation" : "history";
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
  const real = preview ?? progression.data;
  const data = mode === "simulation" ? (draft ?? progression.data) : real;
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
  const program = identity.student
    ? programNames[identity.student.program]
    : "Coordenação";
  const nextTerm =
    progression.data?.forecast?.first_remaining_term ??
    (startTerm ? termOf(startTerm, currentPeriod + 1) : calendarTerm(1));

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
  // Atalhos por URL: ?editar=1 abre o editor; ?plano=<id> abre uma alternativa.
  useEffect(() => {
    if (params.get("editar") && history.data) {
      setEditingHistory(true);
      params.delete("editar");
      setParams(params, { replace: true });
    }
  }, [params, setParams, history.data]);
  useEffect(() => {
    const id = params.get("plano");
    if (!id || page !== "simulation") return;
    params.delete("plano");
    setParams(params, { replace: true });
    if (draft?.id !== id) void run(async () => open(await api.getPlan(id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, page]);
  // Depois de escolher uma disciplina na busca, rola o mapa até ela.
  useEffect(() => {
    if (!scrollTo) return;
    const frame = requestAnimationFrame(() => {
      document
        .querySelector(`[data-course-id="${CSS.escape(scrollTo)}"]`)
        ?.scrollIntoView({
          block: "center",
          inline: "center",
          behavior: "smooth",
        });
      setScrollTo(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [scrollTo, page]);

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
  /** Simulação sem alternativa aberta: o primeiro arraste cria um rascunho. */
  async function ensureDraft() {
    if (draft) return { plan: draft, created: false };
    const count = (plans.data?.length ?? 0) + 1;
    const plan = await api.createPlan(`Rascunho ${count}`, nextTerm);
    open(plan);
    await plans.refetch();
    return { plan, created: true };
  }
  function arrange(
    base: Plan,
    courseId: string,
    period: number | null,
    beforeId?: string,
  ) {
    const course_layout = moveCourse(
      base.courses,
      base.course_layout,
      courseId,
      period,
      beforeId,
    );
    if (course_layout === base.course_layout) return false;
    if (period === null && base.planned_ids.includes(courseId)) {
      void run(async () => {
        const result = await api.evaluatePlan(base.id, {
          version: base.version,
          history_revision: base.history_revision,
          planned_ids: base.planned_ids,
          hypothetical_ids: base.hypothetical_ids,
          course_layout,
          action: { kind: "unplan", course_id: courseId },
        });
        setDraft({ ...base, ...result });
        setNotice(
          "Eletiva devolvida ao catálogo. Clique em Salvar para persistir.",
        );
      });
      return true;
    }
    setDraft({ ...base, course_layout });
    return true;
  }
  function move(
    courseId: string,
    period: number | null,
    beforeId?: string,
    prefix = "",
  ) {
    if (busy) return;
    if (draft) {
      if (arrange(draft, courseId, period, beforeId))
        setNotice(
          `${prefix}Distribuição alterada. Clique em Salvar para persistir.`,
        );
      return;
    }
    void run(async () => {
      const { plan } = await ensureDraft();
      arrange(plan, courseId, period, beforeId);
      setNotice(
        `${prefix}Criamos a alternativa “${plan.name}” (${plan.target_term}) para guardar sua arrumação. Clique em Salvar para persistir.`,
      );
    });
  }
  function moveInHistory(courseId: string, period: number | null) {
    const course = data?.courses.find((c) => c.id === courseId);
    if (!course || busy) return;
    if (period !== null && period > currentPeriod) {
      // Período futuro é planejamento: a disciplina vai para a Simulação.
      navigate("/simulacao");
      move(
        courseId,
        period,
        undefined,
        "Períodos futuros ficam na Simulação, separados do seu histórico. ",
      );
      return;
    }
    if (!startTerm) {
      setError(
        "Informe o semestre de ingresso em “Editar histórico” antes de registrar cadeiras no mapa.",
      );
      return;
    }
    const own = records
      .filter((r) => r.course_id === courseId)
      .sort((a, b) => a.academic_term.localeCompare(b.academic_term));
    if (period === null) {
      if (course.type !== "elective") return;
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
      `${course.type === "elective" ? "Eletiva registrada" : `Registrada em ${term}`} no histórico. Ajuste situação e nota no painel e clique em Salvar histórico.`,
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
  /** Obrigatórias de um período já cursado que ainda não têm registro. */
  function unrecorded(period: number) {
    return (
      data?.courses.filter(
        (c) =>
          c.type === "mandatory" &&
          c.period === period &&
          !records.some((r) => r.course_id === c.id),
      ) ?? []
    );
  }
  /**
   * Períodos já cursados viram "aprovadas"; o período atual vira "cursando". O que o
   * estudante não fez continua sem registro e aparece como "Não cursada/Não cursando".
   */
  function approvePeriod(period: number) {
    if (!startTerm) return;
    const term = termOf(startTerm, period);
    const missing = unrecorded(period);
    if (!missing.length) return;
    const current = period === currentPeriod;
    editHistory([
      ...records,
      ...missing.map((c) => ({
        course_id: c.id,
        academic_term: term,
        status: current ? ("in_progress" as const) : ("completed" as const),
      })),
    ]);
    const n = missing.length;
    const plural = n > 1 ? "s" : "";
    setNotice(
      current
        ? `${n} disciplina${plural} do ${period}º período marcada${plural} como cursando. Se não está cursando alguma, abra o card e clique em “Marcar como não cursada”; depois, Salvar histórico.`
        : `${n} disciplina${plural} do ${period}º período marcada${plural} como aprovada${plural}. Ajuste exceções e notas no mapa e clique em Salvar histórico.`,
    );
  }
  /** Obrigatória sem registro em período já cursado (atrasada) ou no atual (fora agora). */
  function gapOf(course: {
    id: string;
    type: string;
    period: number | null;
    status: string;
  }) {
    if (course.type !== "mandatory" || course.period === null) return null;
    if (records.some((r) => r.course_id === course.id)) return null;
    if (course.status === "completed" || course.status === "in_progress")
      return null;
    if (course.period < currentPeriod) return "late" as const;
    if (course.period === currentPeriod) return "skipped" as const;
    return null;
  }
  function createFromSuggestion(ids: string[], name: string, term: string) {
    if (!discard() || !progression.data) return;
    const ongoing = progression.data.in_progress_ids;
    void run(async () => {
      const plan = await api.createPlan(name, term);
      // As sugeridas vão para o período do semestre-alvo no mapa do plano.
      const target = startTerm ? periodOf(startTerm, term) : currentPeriod + 1;
      let course_layout = plan.course_layout;
      if (target >= 1 && target <= 20)
        for (const id of ids)
          course_layout = moveCourse(plan.courses, course_layout, id, target);
      // As cadeiras em andamento entram como aprovação simulada: assim o plano
      // libera o que depende delas, como na sugestão.
      const result = await api.evaluatePlan(plan.id, {
        version: plan.version,
        history_revision: plan.history_revision,
        planned_ids: ids,
        hypothetical_ids: ongoing,
        course_layout,
      });
      open(await api.savePlan({ ...plan, ...result }));
      await plans.refetch();
      navigate("/simulacao");
      setNotice(
        `Alternativa “${name}” criada com ${ids.length} disciplinas planejadas. As que estão em andamento aparecem como aprovação simulada.`,
      );
    });
  }
  function openPlan(id: string) {
    if (!discard()) return;
    navigate(`/simulacao?plano=${encodeURIComponent(id)}`);
  }
  function focusCourse(id: string) {
    if (page !== "history" && page !== "simulation") navigate("/historico");
    setSearch("");
    setFilter("all");
    setSelectedId(id);
    setScrollTo(id);
  }

  const periodCount = Math.max(
    8,
    ...(data?.courses.map((c) => c.period ?? 0) ?? []),
  );
  const mapLayout =
    mode === "history"
      ? startTerm && data
        ? historyLayout(data.courses, records, startTerm)
        : {}
      : (draft?.course_layout ?? {});
  const query = search.toLocaleLowerCase("pt-BR");
  const visible =
    data?.courses.filter(
      (c) =>
        (filter === "all" ||
          (filter === "critical" ? c.critical : c.status === filter)) &&
        courseName(c).toLocaleLowerCase("pt-BR").includes(query),
    ) ?? [];
  const related = new Set(
    selected ? [...selected.prerequisite_ids, ...selected.dependent_ids] : [],
  );
  const commands = useMemo<Command[]>(() => {
    const pages: Command[] = studentNav.map(({ to, label, icon: Icon }) => ({
      id: `page-${to}`,
      group: "Páginas",
      label,
      icon: <Icon size={16} />,
      run: () => navigate(to),
    }));
    const actions: Command[] = [
      {
        id: "action-edit",
        group: "Ações",
        label: "Editar histórico ou importar PDF",
        icon: <FilePlus2 size={16} />,
        run: () => navigate("/historico?editar=1"),
      },
      {
        id: "action-print",
        group: "Ações",
        label: "Exportar PDF desta página",
        icon: <Download size={16} />,
        run: () => setTimeout(() => window.print(), 50),
      },
    ];
    const courses: Command[] = (real?.courses ?? []).map((c) => ({
      id: `course-${c.id}`,
      group: "Disciplinas",
      label: courseName(c),
      hint: `${c.type === "elective" ? "Eletiva" : `${c.period}º período`} · ${statusMeta[c.status].label}`,
      keywords: `${c.source_code ?? ""} ${c.short_name}`,
      icon: <BookOpen size={16} />,
      run: () => focusCourse(c.id),
    }));
    return [...pages, ...actions, ...courses];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [real, page]);

  const logout = () => {
    if (discard())
      void run(async () => {
        await api.logout();
        onLogout();
      });
  };
  const curriculum = identity.student?.curriculum;
  const footer = (
    <p className="institution-note">
      {`Matriz ${curriculum?.id ?? ""} transcrita do CIn`}
      {curriculum?.source_url?.startsWith("https://") && (
        <>
          {" "}
          ·{" "}
          <a href={curriculum.source_url} target="_blank" rel="noreferrer">
            Consultar fonte
          </a>
        </>
      )}{" "}
      · pré-requisitos conferidos no PPC do curso, sem validação da coordenação
      · o histórico é informado pelo estudante · a matrícula oficial continua no
      SIGAA.
    </p>
  );
  const banners = (
    <>
      {failure && (
        <div className="banner error">
          <p role="alert">{failure}</p>
          <button
            className="ghost-button"
            disabled={busy}
            onClick={() => void refresh()}
          >
            Recarregar dados
          </button>
        </div>
      )}
      {notice && (
        <p role="status" className="banner success">
          {notice}
        </p>
      )}
    </>
  );
  const shellProps = {
    title: titles[page],
    subtitle: identity.student
      ? `${program} · ${currentPeriod}º período${curriculum?.id ? ` · matriz ${curriculum.id}` : ""}`
      : "Coordenação",
    program,
    email: identity.user.email,
    busy,
    onLogout: logout,
    onImport: isStudent ? () => navigate("/historico?editar=1") : undefined,
    commands: isStudent ? commands : [],
    footer,
  };

  if (!isStudent)
    return (
      <AppShell {...shellProps}>
        {banners}
        <p>
          Conta da coordenação. A importação de histórico está disponível nos
          endpoints documentados da API.
        </p>
      </AppShell>
    );

  const printFacts = (source: Progression | Plan): [string, string][] => [
    ["Integralização", `${trackedPercent(source.integralization)}%`],
    [
      "Previsão de conclusão",
      source.forecast?.estimated_completion_term ??
        `${source.forecast?.estimated_semesters ?? "—"} semestres`,
    ],
    ["CR", formatGrade(source.cr?.value)],
    ["Período atual", `${currentPeriod}º`],
  ];

  if (page === "overview" || page === "next" || page === "compare")
    return (
      <AppShell {...shellProps}>
        {banners}
        {history.isLoading && <p role="status">Carregando histórico…</p>}
        {page === "overview" && real && (
          <>
            <Overview
              data={real}
              records={records}
              startTerm={startTerm}
              currentPeriod={currentPeriod}
              onSelectCourse={focusCourse}
              onExport={() => window.print()}
            />
            <PrintReport
              title={`Histórico acadêmico · ${program}`}
              subtitle={`${identity.user.email} · matriz ${curriculum?.id ?? ""}`}
              facts={printFacts(real)}
              courses={real.courses}
              layout={
                startTerm ? historyLayout(real.courses, records, startTerm) : {}
              }
              showGrades
            />
          </>
        )}
        {page === "next" && real && (
          <NextSemester
            data={real}
            startTerm={startTerm}
            currentPeriod={currentPeriod}
            busy={busy}
            onCreate={createFromSuggestion}
            onSelectCourse={focusCourse}
          />
        )}
        {page === "compare" && plans.data && (
          <ComparePlans plans={plans.data} onOpen={openPlan} />
        )}
      </AppShell>
    );

  return (
    <AppShell
      {...shellProps}
      actions={
        mode === "simulation" && draft ? (
          <>
            <SharePanel
              planId={draft.id}
              token={draft.share_token}
              onChange={(token) => {
                setDraft({ ...draft, share_token: token });
                setSaved((current) =>
                  current ? { ...current, share_token: token } : current,
                );
                void plans.refetch();
              }}
            />
            <button
              type="button"
              className="ghost-button"
              onClick={() => window.print()}
            >
              <Download size={15} aria-hidden="true" /> Exportar PDF
            </button>
          </>
        ) : undefined
      }
    >
      <div className={`workspace mode-${mode}`}>
        {data && (
          <KpiStrip
            mode={mode}
            cr={data.cr?.value}
            simulatedCr={
              mode === "simulation" ? draft?.cr?.simulated_value : null
            }
            ungraded={data.cr?.ungraded_attempts}
            integralization={data.integralization}
            forecast={data.forecast}
            dirty={mode === "history" ? historyDirty : planDirty}
            counts={
              mode === "history"
                ? [
                    { label: "aprovadas", value: data.counts.completed },
                    { label: "em andamento", value: data.counts.in_progress },
                  ]
                : [
                    { label: "aprov. simuladas", value: data.counts.simulated },
                    {
                      label: "carga planejada",
                      value: `${data.planned_hours ?? 0}h`,
                    },
                  ]
            }
          />
        )}
        {banners}
        {history.isLoading && <p role="status">Carregando histórico…</p>}
        {history.data?.awaiting_import && (
          <section className="banner" aria-label="Histórico vazio">
            <div>
              <h2 className="font-semibold">Nenhuma cadeira registrada</h2>
              <p className="mt-1 text-sm">
                Informe as cadeiras que já cursou para atualizar seu mapa.
              </p>
            </div>
          </section>
        )}
        {history.data && progression.data && editingHistory && (
          <section className="mb-5">
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
          </section>
        )}
        <section
          id="alternatives"
          className="alternatives-panel mode-toolbar panel mb-4"
          data-mode={mode}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="font-semibold">
                {mode === "history"
                  ? "Histórico informado"
                  : draft
                    ? "Cenário hipotético"
                    : "Alternativas"}
              </h2>
              <span className="toolbar-meta">
                Revisão {data?.history_revision ?? "—"} ·{" "}
                {data?.current_period ?? "—"}º período
              </span>
              {history.data?.import && (
                <span className="toolbar-meta">
                  Atualizado em{" "}
                  {new Date(history.data.import.created_at).toLocaleString(
                    "pt-BR",
                  )}{" "}
                  · {history.data.import.source}
                  {history.data.import.source !==
                    "Informado pelo estudante" && (
                    <> · referência {history.data.import.source_reference}</>
                  )}
                </span>
              )}
            </div>
            {mode === "history" && history.data && !editingHistory && (
              <button
                className={button}
                onClick={() => {
                  if (discard()) setEditingHistory(true);
                }}
              >
                Editar histórico
              </button>
            )}
          </div>
          {(history.data?.warnings.length ?? 0) + (data?.warnings.length ?? 0) >
            0 && (
            <details className="toolbar-warnings mt-2">
              <summary>
                {(history.data?.warnings.length ?? 0) +
                  (data?.warnings.length ?? 0)}{" "}
                aviso(s) sobre os dados
              </summary>
              {data?.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
              {history.data?.warnings.map((warning, i) => (
                <p key={i}>
                  {warning.course_id} ({warning.academic_term}):{" "}
                  {warning.message}
                </p>
              ))}
            </details>
          )}
          {mode === "history" && (
            <div className="history-mode mt-2">
              <p className="toolbar-hint">
                O que <strong>já aconteceu</strong>: arraste qualquer disciplina
                para o período em que você a cursou, ou clique nela para
                registrar aprovação, reprovação e nota. Períodos futuros levam à{" "}
                <NavLink to="/simulacao">Simulação</NavLink>.
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
              <div className="toolbar-row mt-3">
                <label className="text-xs text-slate-600">
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
                  className="flex flex-wrap items-end gap-3"
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
                      placeholder={nextTerm}
                      value={newTerm}
                      onChange={(e) => setNewTerm(e.target.value)}
                    />
                  </label>
                  <button className={button} disabled={busy}>
                    Criar alternativa
                  </button>
                </form>
              </div>
              {!draft && (
                <p className="toolbar-hint mt-2">
                  Arraste qualquer disciplina no mapa: o primeiro movimento cria
                  um rascunho para você.
                </p>
              )}
              {draft && (
                <div className="mt-4 border-t border-slate-200 pt-3">
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
                      className={`${button} danger-text`}
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
                  <p className="toolbar-hint mt-2">
                    {dirty ? "Alterações pendentes" : "Versão salva"} · somente
                    aprovações simuladas liberam dependentes. Planejar não
                    libera pré-requisitos.
                  </p>
                  {!draft.valid && (
                    <div className="banner warn mt-3">
                      <div>
                        <p>
                          Este plano precisa de ajustes antes de salvar. Suas
                          escolhas foram preservadas.
                        </p>
                        {Object.entries(draft.problems).map(([id, issues]) => (
                          <div key={id} className="mt-2">
                            <span>
                              {courseName(
                                data?.courses.find((c) => c.id === id) ?? {
                                  name: id,
                                },
                              )}
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
                                      history_revision: draft.history_revision,
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
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </section>
        {data && (
          <div className="workspace-grid">
            <div className="min-w-0">
              {mode === "simulation" && (
                <p className="draft-banner" role="note">
                  <strong>Rascunho</strong> · nada aqui altera seu histórico
                </p>
              )}
              <CurriculumMap
                key={mode === "history" ? "history" : (draft?.id ?? "official")}
                courses={visible}
                allCourses={data.courses}
                layout={mapLayout}
                editable={!busy}
                editHint={
                  mode === "history"
                    ? "Arraste uma disciplina para o período em que a cursou. Clique para registrar situação e nota; clique de novo para desmarcar."
                    : "Arraste os cards entre os períodos. Solte sobre um card para inserir antes dele; clique de novo num card para desmarcar."
                }
                needsInfo={
                  mode === "history"
                    ? (course) =>
                        course.type === "mandatory" &&
                        course.period === 1 &&
                        currentPeriod > 1 &&
                        !records.some((r) => r.course_id === course.id)
                    : undefined
                }
                onMove={
                  mode === "history"
                    ? (id, period) => moveInHistory(id, period)
                    : move
                }
                selectedId={selectedId}
                relatedIds={related}
                onSelect={setSelectedId}
                periodNote={
                  mode === "history"
                    ? (period) =>
                        period > currentPeriod ? "Futuro → Simulação" : null
                    : undefined
                }
                gapOf={mode === "history" ? gapOf : undefined}
                periodLabel={
                  startTerm
                    ? (period) =>
                        `${termOf(startTerm, period)}${period === currentPeriod ? " · atual" : ""}`
                    : undefined
                }
                filters={
                  <div className="map-filters">
                    <label className="text-xs">
                      Buscar disciplina
                      <input
                        className={`${input} compact-input`}
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </label>
                    <label className="text-xs">
                      Estado acadêmico
                      <select
                        className={`${input} compact-input`}
                        value={filter}
                        onChange={(e) =>
                          setFilter(
                            e.target.value as Status | "all" | "critical",
                          )
                        }
                      >
                        {[
                          ["all", "Todas"],
                          ["critical", "Críticas (muitas dependentes)"],
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
                }
                criticalPathIds={data.forecast?.critical_path_ids}
                periodAction={
                  mode === "history" && startTerm
                    ? (period) =>
                        period <= currentPeriod &&
                        unrecorded(period).length > 0 ? (
                          <button
                            type="button"
                            className="period-approve"
                            disabled={busy}
                            aria-label={
                              period === currentPeriod
                                ? `Marcar ${period}º período como cursando`
                                : `Marcar ${period}º período como aprovado`
                            }
                            onClick={() => approvePeriod(period)}
                          >
                            {period === currentPeriod
                              ? "◷ Marcar período como cursando"
                              : "✓ Marcar período como aprovado"}
                          </button>
                        ) : null
                    : undefined
                }
              />
            </div>
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
              impactSlot={
                selected && real ? (
                  <FailureImpactPanel
                    key={selected.id}
                    course={
                      real.courses.find((c) => c.id === selected.id) ?? selected
                    }
                    courses={real.courses}
                    revision={history.data?.revision ?? 0}
                  />
                ) : undefined
              }
              moveSlot={
                selected ? (
                  <label className="move-control">
                    Mover {courseName(selected)} para período
                    <select
                      aria-label={`Mover ${courseName(selected)} para período`}
                      className={input}
                      value={coursePeriod(selected, mapLayout) ?? "catalog"}
                      disabled={busy}
                      onChange={(e) => {
                        const value = e.target.value;
                        const period =
                          value === "catalog" ? null : Number(value);
                        if (mode === "history")
                          moveInHistory(selected.id, period);
                        else move(selected.id, period);
                      }}
                    >
                      {selected.type === "elective" && (
                        <option value="catalog">
                          {mode === "history"
                            ? "Fora do histórico (catálogo)"
                            : "Catálogo de eletivas"}
                        </option>
                      )}
                      {Array.from({ length: periodCount }, (_, i) => i + 1).map(
                        (p) => (
                          <option key={p} value={p}>
                            {p}º período
                            {mode === "history" && p > currentPeriod
                              ? " (Simulação)"
                              : ""}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                ) : undefined
              }
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
                            coursePeriod(selected, mapLayout) ??
                              currentPeriod - 1,
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
                    <p className="details-note warn">
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
        {data && (
          <div className="mt-6">
            <ProgressSummary
              integralization={data.integralization}
              forecast={data.forecast}
              courses={data.courses}
              onSelect={setSelectedId}
            />
          </div>
        )}
        {data && (
          <PrintReport
            title={
              mode === "simulation" && draft
                ? `Plano “${draft.name}” · ${draft.target_term}`
                : `Histórico acadêmico · ${program}`
            }
            subtitle={`${program} · matriz ${curriculum?.id ?? ""}`}
            facts={printFacts(data)}
            courses={data.courses}
            layout={mapLayout}
            showGrades={mode === "history"}
          />
        )}
      </div>
    </AppShell>
  );
}
