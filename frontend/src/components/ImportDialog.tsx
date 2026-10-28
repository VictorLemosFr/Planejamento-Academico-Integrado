import { useEffect, useRef, useState } from "react";
import { FileUp, ShieldCheck, X } from "lucide-react";
import { courseShortName } from "../display";
import { formatGrade } from "../academicTerms";
import type {
  Course,
  HistoryRecord,
  HistoryUpdate,
  TranscriptProposal,
} from "../types";

type Group = { key: string; label: string; tone: string; items: string[] };

/**
 * Importar o PDF do SIGAA em um passo: lê, mostra o resumo do que foi entendido
 * (aprovadas, reprovadas, cursando e o que ficou sem cursar) e salva.
 */
export function ImportDialog({
  open,
  onClose,
  courses,
  current,
  readTranscript,
  onImport,
}: {
  open: boolean;
  onClose: () => void;
  courses: Course[];
  current: {
    start_term: string | null;
    current_period: number;
    records: HistoryRecord[];
  };
  readTranscript: (file: File) => Promise<TranscriptProposal>;
  onImport: (update: HistoryUpdate, summary: string) => Promise<void>;
}) {
  const [proposal, setProposal] = useState<TranscriptProposal | null>(null);
  const [mode, setMode] = useState<"replace" | "merge">("replace");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) {
      setProposal(null);
      setError("");
      setMode("replace");
    }
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open, onClose]);
  if (!open) return null;

  const byId = new Map(courses.map((c) => [c.id, c]));
  const name = (id: string) =>
    byId.get(id) ? courseShortName(byId.get(id)!) : id;
  async function read(selected: File | undefined) {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      setProposal(await readTranscript(selected));
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
      if (file.current) file.current.value = "";
    }
  }

  const startTerm = proposal?.start_term ?? current.start_term;
  const period = proposal?.current_period ?? current.current_period;
  const found: HistoryRecord[] =
    proposal?.records.map((r) => ({
      course_id: r.course_id,
      academic_term: r.academic_term,
      status: r.status,
      grade: r.grade ?? null,
    })) ?? [];
  const records =
    mode === "replace"
      ? found
      : [
          ...current.records.filter(
            (r) =>
              !found.some(
                (f) =>
                  f.course_id === r.course_id &&
                  f.academic_term === r.academic_term,
              ),
          ),
          ...found,
        ];
  const latest = new Map<string, HistoryRecord>();
  for (const r of [...records].sort((a, b) =>
    a.academic_term.localeCompare(b.academic_term),
  ))
    latest.set(r.course_id, r);
  const recorded = new Set(records.map((r) => r.course_id));
  const notTaken = courses.filter(
    (c) =>
      c.type === "mandatory" &&
      c.period !== null &&
      c.period <= period &&
      !recorded.has(c.id),
  );
  const groups: Group[] = proposal
    ? [
        {
          key: "completed",
          label: "Aprovadas",
          tone: "good",
          items: [...latest.values()]
            .filter((r) => r.status === "completed")
            .map(
              (r) =>
                `${name(r.course_id)}${r.grade != null ? ` · ${formatGrade(r.grade)}` : ""}`,
            ),
        },
        {
          key: "failed",
          label: "Reprovações",
          tone: "bad",
          items: records
            .filter((r) => r.status === "failed")
            .map(
              (r) =>
                `${name(r.course_id)} (${r.academic_term})${r.grade != null ? ` · ${formatGrade(r.grade)}` : ""}`,
            ),
        },
        {
          key: "in_progress",
          label: "Cursando agora",
          tone: "accent",
          items: [...latest.values()]
            .filter((r) => r.status === "in_progress")
            .map((r) => name(r.course_id)),
        },
        {
          key: "not_taken",
          label: "Obrigatórias ainda não cursadas",
          tone: "warn",
          items: notTaken.map((c) => `${courseShortName(c)} · ${c.period}º`),
        },
      ]
    : [];
  const skipped = [
    ...(proposal?.unmatched ?? []),
    ...(proposal?.ignored ?? []),
  ];
  const counts = groups.map((g) => g.items.length);
  const summary = `Histórico importado do PDF: ${counts[0]} aprovada(s), ${counts[1]} reprovação(ões), ${counts[2]} cursando.`;

  return (
    <div className="palette-backdrop" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Importar histórico do SIGAA"
        className="import-dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="import-head">
          <h2>Importar histórico do SIGAA</h2>
          <button type="button" aria-label="Fechar" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        {!proposal ? (
          <>
            <ol className="import-steps">
              <li>
                No SIGAA, emita seu <strong>histórico escolar</strong> (menu
                Ensino) e salve o PDF.
              </li>
              <li>
                Escolha o arquivo abaixo: aprovações, reprovações, notas e o que
                você está cursando são preenchidos sozinhos.
              </li>
              <li>Confira o resumo e salve.</li>
            </ol>
            <label className="dropzone">
              <FileUp size={22} aria-hidden="true" />
              <span>
                {busy ? "Lendo o PDF…" : "Escolher o PDF do histórico"}
              </span>
              <input
                ref={file}
                type="file"
                accept="application/pdf,.pdf"
                aria-label="PDF do histórico (SIGAA)"
                disabled={busy}
                onChange={(event) => void read(event.target.files?.[0])}
              />
            </label>
            <p className="privacy-note">
              <ShieldCheck size={15} aria-hidden="true" /> O PDF é lido na hora
              e descartado: só ficam as disciplinas, semestres, situações e
              notas.
            </p>
          </>
        ) : (
          <>
            <p className="import-facts">
              {startTerm && (
                <>
                  Ingresso <strong>{startTerm}</strong> ·{" "}
                </>
              )}
              <strong>{period}º período</strong>
              {proposal.sigaa_indices?.cr != null && (
                <>
                  {" "}
                  · no SIGAA: CR{" "}
                  <strong>
                    {proposal.sigaa_indices.cr.toLocaleString("pt-BR")}
                  </strong>
                  {proposal.sigaa_indices.mc != null && (
                    <>
                      , MC{" "}
                      <strong>
                        {proposal.sigaa_indices.mc.toLocaleString("pt-BR")}
                      </strong>
                    </>
                  )}
                </>
              )}
            </p>
            <div className="import-groups" aria-label="Resumo da importação">
              {groups.map((g) => (
                <section key={g.key} data-tone={g.tone}>
                  <h3>
                    {g.label} <span>{g.items.length}</span>
                  </h3>
                  {g.items.length ? (
                    <ul>
                      {g.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted small">Nenhuma.</p>
                  )}
                </section>
              ))}
            </div>
            {skipped.length > 0 && (
              <details className="left-out">
                <summary>
                  {skipped.length} linha(s) do PDF fora da sua matriz
                </summary>
                <ul>
                  {skipped.map((s, i) => (
                    <li key={`${s.code}-${i}`}>
                      {s.code} {s.academic_term ? `(${s.academic_term})` : ""} ·{" "}
                      <span className="muted">{s.reason}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {current.records.length > 0 && (
              <fieldset className="import-mode">
                <legend>Você já tem registros no histórico</legend>
                <label className="check">
                  <input
                    type="radio"
                    name="import-mode"
                    checked={mode === "replace"}
                    onChange={() => setMode("replace")}
                  />
                  Substituir pelo PDF (recomendado)
                </label>
                <label className="check">
                  <input
                    type="radio"
                    name="import-mode"
                    checked={mode === "merge"}
                    onChange={() => setMode("merge")}
                  />
                  Juntar com o que já informei
                </label>
              </fieldset>
            )}
            {error && <p role="alert">{error}</p>}
            <div className="import-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={() => setProposal(null)}
              >
                Escolher outro PDF
              </button>
              <button
                type="button"
                className="primary-action"
                disabled={busy || !found.length || !startTerm}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await onImport(
                      {
                        start_term: startTerm!,
                        current_period: period,
                        records,
                      },
                      summary,
                    );
                  } catch (failure) {
                    setError((failure as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Importar e salvar
              </button>
            </div>
          </>
        )}
        {!proposal && error && <p role="alert">{error}</p>}
      </div>
    </div>
  );
}
