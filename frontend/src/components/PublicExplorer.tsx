import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import * as api from "../api";
import type { Identity, PublicGrid, Status } from "../types";
import { CurriculumMap } from "./CurriculumMap";
import { CourseDetails } from "./CourseDetails";
import { ProgressSummary } from "./ProgressSummary";
import { KpiStrip } from "./KpiStrip";
import { AppShell } from "./AppShell";
import { courseName } from "../display";

const input =
  "glass-input mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";
const button =
  "glass-button rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50";
const validTerm = (term: string) => /^\d{4}\.[12]$/.test(term);

/** Grade navegável sem conta: as aprovações são hipotéticas e nada é gravado. */
export function PublicExplorer({ identity }: { identity: Identity | null }) {
  const [params, setParams] = useSearchParams();
  const curricula = useQuery({
    queryKey: ["public-curricula"],
    queryFn: api.getPublicCurricula,
  });
  const requested = params.get("matriz");
  const curriculumId =
    curricula.data?.find((c) => c.id === requested)?.id ??
    curricula.data?.find((c) => c.program === "SI")?.id ??
    curricula.data?.[0]?.id;
  const [grid, setGrid] = useState<PublicGrid | null>(null);
  const [period, setPeriod] = useState(1);
  const [startTerm, setStartTerm] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Status | "all" | "critical">("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!curriculumId) return;
    let active = true;
    setGrid(null);
    setSelectedId(null);
    setError("");
    api
      .getPublicGrid(curriculumId)
      .then((result) => active && setGrid(result))
      .catch((failure) => active && setError(failure.message));
    return () => {
      active = false;
    };
  }, [curriculumId]);

  async function simulate(
    changes: {
      action?: "approve" | "revoke";
      course_id?: string;
      hypothetical_ids?: string[];
      current_period?: number;
      start_term?: string;
    } = {},
  ) {
    if (!curriculumId || !grid) return;
    const term = changes.start_term ?? startTerm;
    setBusy(true);
    setError("");
    try {
      setGrid(
        await api.simulatePublic(curriculumId, {
          current_period: changes.current_period ?? period,
          start_term: validTerm(term) ? term : null,
          hypothetical_ids: changes.hypothetical_ids ?? grid.hypothetical_ids,
          action: changes.action,
          course_id: changes.course_id,
        }),
      );
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const selected = grid?.courses.find((c) => c.id === selectedId);
  const visible =
    grid?.courses.filter(
      (c) =>
        (filter === "all" ||
          (filter === "critical" ? c.critical : c.status === filter)) &&
        courseName(c)
          .toLocaleLowerCase("pt-BR")
          .includes(search.toLocaleLowerCase("pt-BR")),
    ) ?? [];
  const current = curricula.data?.find((c) => c.id === curriculumId);
  const footer = current ? (
    <p className="institution-note">
      Transcrita de{" "}
      <a
        href={current.source_url}
        target="_blank"
        rel="noreferrer"
        className="underline"
      >
        página pública do CIn
      </a>{" "}
      · pendente de validação institucional
      {current.unverified_count > 0
        ? ` · pré-requisitos conferidos no PPC, exceto ${current.unverified_count} disciplina${current.unverified_count > 1 ? "s" : ""}`
        : " · pré-requisitos conferidos no PPC"}
      .
    </p>
  ) : null;

  return (
    <AppShell
      title="Explorar grades"
      subtitle="Simule aprovações em qualquer curso do CIn. Nada é salvo."
      program={identity?.student ? "Explorar grades" : "CIn/UFPE"}
      email={identity?.user.email}
      signedIn={!!identity}
      footer={footer}
    >
      {curricula.error && (
        <p role="alert" className="mb-4 text-sm text-red-700">
          {curricula.error.message}
        </p>
      )}
      <div className="program-tabs mb-4" role="group" aria-label="Curso">
        {curricula.data?.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={item.id === curriculumId}
            disabled={busy}
            onClick={() => {
              setParams({ matriz: item.id });
              setFilter("all");
              setSearch("");
            }}
          >
            <strong>
              {item.program} · {item.program_name}
            </strong>
            <small>
              Matriz {item.id} · ingressantes desde {item.valid_from} ·{" "}
              {item.course_count} disciplinas
            </small>
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="mb-4 text-sm text-red-700">
          {error}
        </p>
      )}
      {!grid && !error && <p role="status">Carregando grade…</p>}
      {grid && (
        <>
          <KpiStrip
            mode="public"
            integralization={grid.integralization}
            forecast={grid.forecast}
            counts={[
              {
                label: "aprov. simuladas",
                value: grid.hypothetical_ids.length,
              },
            ]}
          />
          <div className="filter-bar mb-5 flex flex-wrap gap-3">
            <label className="text-xs">
              Período atual
              <select
                className={input}
                value={period}
                disabled={busy}
                onChange={(e) => {
                  setPeriod(Number(e.target.value));
                  void simulate({ current_period: Number(e.target.value) });
                }}
              >
                {Array.from({ length: 14 }, (_, i) => i + 1).map((p) => (
                  <option key={p} value={p}>
                    {p}º período
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              Ingresso (opcional)
              <input
                className={input}
                placeholder="2025.1"
                pattern="[0-9]{4}\.[12]"
                value={startTerm}
                disabled={busy}
                onChange={(e) => {
                  setStartTerm(e.target.value);
                  if (validTerm(e.target.value) || !e.target.value)
                    void simulate({ start_term: e.target.value });
                }}
              />
            </label>
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
                onChange={(e) =>
                  setFilter(e.target.value as Status | "all" | "critical")
                }
              >
                {[
                  ["all", "Todas"],
                  ["critical", "Críticas (muitas dependentes)"],
                  ["simulated", "Aprovação simulada"],
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
            <button
              type="button"
              className={button}
              disabled={busy || !grid.hypothetical_ids.length}
              onClick={() => void simulate({ hypothetical_ids: [] })}
            >
              Limpar simulação ({grid.hypothetical_ids.length})
            </button>
          </div>
          <div className="workspace-grid">
            <CurriculumMap
              key={curriculumId}
              courses={visible}
              allCourses={grid.courses}
              selectedId={selectedId}
              relatedIds={
                new Set(
                  selected
                    ? [...selected.prerequisite_ids, ...selected.dependent_ids]
                    : [],
                )
              }
              onSelect={setSelectedId}
              criticalPathIds={grid.forecast?.critical_path_ids}
            />
            <CourseDetails
              course={selected}
              courses={grid.courses}
              busy={busy}
              allowPlanning={false}
              onAction={(kind) => {
                if ((kind === "approve" || kind === "revoke") && selectedId)
                  void simulate({ action: kind, course_id: selectedId });
              }}
              onSelect={setSelectedId}
              onClose={() => setSelectedId(null)}
            />
          </div>
          <div className="mt-6">
            <ProgressSummary
              integralization={grid.integralization}
              forecast={grid.forecast}
              courses={grid.courses}
              onSelect={setSelectedId}
            />
          </div>
        </>
      )}
    </AppShell>
  );
}
