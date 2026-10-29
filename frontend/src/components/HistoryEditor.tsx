import { titleCase } from "../display";
import { useRef, useState } from "react";
import type {
  Course,
  History,
  HistoryRecord,
  HistoryUpdate,
  TranscriptProposal,
} from "../types";

const statusLabels: Record<HistoryRecord["status"], string> = {
  completed: "Aprovada",
  in_progress: "Cursando",
  failed: "Reprovada",
};
const key = (r: HistoryRecord) => `${r.course_id}|${r.academic_term}`;

const input =
  "glass-input mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";
const button =
  "glass-button rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50";

export function HistoryEditor({
  history,
  courses,
  onSave,
  onCancel,
  onReadTranscript,
}: {
  history: History;
  courses: Course[];
  onSave: (payload: HistoryUpdate) => Promise<void>;
  onCancel: () => void;
  onReadTranscript?: (file: File) => Promise<TranscriptProposal>;
}) {
  const [startTerm, setStartTerm] = useState(history.start_term ?? "");
  const [currentPeriod, setCurrentPeriod] = useState(
    String(history.current_period),
  );
  const [records, setRecords] = useState<HistoryRecord[]>(history.records);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const [proposal, setProposal] = useState<TranscriptProposal | null>(null);
  const [notice, setNotice] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  async function readFile(file: File | undefined) {
    if (!file || !onReadTranscript) return;
    setBusy(true);
    setFailure("");
    setNotice("");
    try {
      setProposal(await onReadTranscript(file));
    } catch (error) {
      setFailure((error as Error).message);
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function applyProposal(mode: "replace" | "merge") {
    if (!proposal) return;
    const found: HistoryRecord[] = proposal.records.map((r) => ({
      course_id: r.course_id,
      academic_term: r.academic_term,
      status: r.status,
      grade: r.grade ?? null,
    }));
    // Ao mesclar, o PDF prevalece sobre a mesma cadeira no mesmo semestre.
    const merged =
      mode === "replace"
        ? found
        : [
            ...records.filter(
              (r) => !found.some((item) => key(item) === key(r)),
            ),
            ...found,
          ];
    setRecords(merged);
    // O cabeçalho do SIGAA informa ingresso e período atual; valem mais que o palpite.
    if (proposal.start_term) setStartTerm(proposal.start_term);
    if (proposal.current_period)
      setCurrentPeriod(String(proposal.current_period));
    setProposal(null);
    setNotice(
      `${found.length} registros do PDF aplicados. Revise e clique em Salvar histórico.`,
    );
  }

  function update(index: number, value: HistoryRecord) {
    setRecords((current) =>
      current.map((record, i) => (i === index ? value : record)),
    );
  }

  return (
    <form
      className="glass-panel rounded-xl border border-slate-200 bg-white p-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setFailure("");
        try {
          await onSave({
            start_term: startTerm,
            current_period: Number(currentPeriod),
            records,
          });
        } catch (error) {
          setFailure((error as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="font-semibold">Seu histórico</h2>
      <p className="mt-1 text-sm text-slate-600">
        Registre as tentativas de cada cadeira. Esses dados são informados por
        você e não alteram o SIGAA.
      </p>
      {failure && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {failure}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-3 text-sm text-blue-800">
          {notice}
        </p>
      )}
      {onReadTranscript && (
        <div className="transcript-import">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">
                Importar do PDF do SIGAA
              </h3>
              <p className="mt-1 text-xs text-slate-600">
                Use o histórico emitido pelo SIGAA. O arquivo é lido e
                descartado; nada é salvo até você revisar e clicar em Salvar
                histórico.
              </p>
            </div>
            <label className={`${button} cursor-pointer`}>
              {busy ? "Lendo PDF…" : "Escolher PDF"}
              <input
                ref={fileInput}
                type="file"
                accept="application/pdf,.pdf"
                className="sr-only"
                disabled={busy}
                aria-label="PDF do histórico escolar"
                onChange={(event) => void readFile(event.target.files?.[0])}
              />
            </label>
          </div>
          {proposal && (
            <div className="mt-3" aria-label="Prévia da importação">
              <p className="text-sm">
                {proposal.records.length} registro
                {proposal.records.length !== 1 ? "s" : ""} encontrado
                {proposal.records.length !== 1 ? "s" : ""} na sua matriz.
                {proposal.current_period
                  ? ` Ingresso em ${proposal.start_term}, ${proposal.current_period}º período.`
                  : ""}
              </p>
              {proposal.sigaa_indices?.cr != null && (
                <p className="mt-1 text-xs text-slate-600">
                  O SIGAA informa CR{" "}
                  {proposal.sigaa_indices.cr.toLocaleString("pt-BR")}
                  {proposal.sigaa_indices.mc != null &&
                    ` e MC ${proposal.sigaa_indices.mc.toLocaleString("pt-BR")}`}
                  . Depois de salvar, confira na Visão geral: o cálculo daqui
                  segue o mesmo (média ponderada pela carga horária).
                </p>
              )}
              {proposal.records.length > 0 && (
                <table>
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Disciplina</th>
                      <th>Semestre</th>
                      <th>Situação</th>
                      <th>Nota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proposal.records.map((r) => (
                      <tr key={key(r)}>
                        <td className="font-mono">{r.code}</td>
                        <td>{titleCase(r.name)}</td>
                        <td>{r.academic_term}</td>
                        <td>{statusLabels[r.status]}</td>
                        <td>{r.grade ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {proposal.unmatched.length + proposal.ignored.length > 0 && (
                <details className="mt-3 text-xs text-slate-600">
                  <summary className="cursor-pointer font-semibold">
                    {proposal.unmatched.length + proposal.ignored.length} linha
                    {proposal.unmatched.length + proposal.ignored.length !== 1
                      ? "s"
                      : ""}{" "}
                    para conferir manualmente
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {[...proposal.unmatched, ...proposal.ignored].map(
                      (item, i) => (
                        <li key={i}>
                          <span className="font-mono">{item.code}</span>
                          {item.academic_term && ` · ${item.academic_term}`}
                          {item.status_text && ` · ${item.status_text}`} —{" "}
                          {item.reason}
                        </li>
                      ),
                    )}
                  </ul>
                </details>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={button}
                  disabled={!proposal.records.length}
                  onClick={() => applyProposal("replace")}
                >
                  Substituir lista pelo PDF
                </button>
                <button
                  type="button"
                  className={button}
                  disabled={!proposal.records.length}
                  onClick={() => applyProposal("merge")}
                >
                  Mesclar com a lista atual
                </button>
                <button
                  type="button"
                  className={button}
                  onClick={() => setProposal(null)}
                >
                  Descartar leitura
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          Semestre de ingresso
          <input
            className={input}
            required
            placeholder="AAAA.1 ou AAAA.2"
            pattern="[0-9]{4}\.[12]"
            value={startTerm}
            onChange={(event) => setStartTerm(event.target.value)}
          />
        </label>
        <label className="text-sm">
          Período atual
          <input
            className={input}
            type="number"
            min="1"
            max="20"
            required
            value={currentPeriod}
            onChange={(event) => setCurrentPeriod(event.target.value)}
          />
        </label>
      </div>
      <div className="mt-5 space-y-3">
        {records.map((record, index) => (
          <div
            key={index}
            className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.7fr)_auto] sm:items-end"
          >
            <label className="text-sm">
              Disciplina
              <select
                className={input}
                required
                value={record.course_id}
                onChange={(event) =>
                  update(index, { ...record, course_id: event.target.value })
                }
              >
                <option value="">Selecione</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {titleCase(course.name)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Semestre da tentativa
              <input
                className={input}
                required
                placeholder="AAAA.1"
                pattern="[0-9]{4}\.[12]"
                value={record.academic_term}
                onChange={(event) =>
                  update(index, {
                    ...record,
                    academic_term: event.target.value,
                  })
                }
              />
            </label>
            <label className="text-sm">
              Situação
              <select
                className={input}
                value={record.status}
                onChange={(event) =>
                  update(index, {
                    ...record,
                    status: event.target.value as HistoryRecord["status"],
                    grade:
                      event.target.value === "in_progress"
                        ? null
                        : record.grade,
                  })
                }
              >
                <option value="completed">Aprovada</option>
                <option value="in_progress">Cursando</option>
                <option value="failed">Reprovada</option>
              </select>
            </label>
            <label className="text-sm">
              Nota final
              <input
                className={input}
                type="number"
                min="0"
                max="10"
                step="0.1"
                inputMode="decimal"
                disabled={record.status === "in_progress"}
                value={record.grade ?? ""}
                onChange={(event) => {
                  const value = event.target.value.replace(",", ".");
                  const grade = value === "" ? null : Number(value);
                  if (grade === null || (grade >= 0 && grade <= 10))
                    update(index, { ...record, grade });
                }}
              />
            </label>
            <button
              type="button"
              className={button}
              onClick={() =>
                setRecords((current) => current.filter((_, i) => i !== index))
              }
            >
              Remover
            </button>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          className={button}
          onClick={() =>
            setRecords((current) => [
              ...current,
              { course_id: "", academic_term: startTerm, status: "completed" },
            ])
          }
        >
          Adicionar cadeira
        </button>
        <button
          className={`${button} border-blue-700 bg-blue-700 text-white`}
          disabled={busy}
        >
          {busy ? "Salvando…" : "Salvar histórico"}
        </button>
        <button
          type="button"
          className={button}
          disabled={busy}
          onClick={onCancel}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
