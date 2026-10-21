import { useState } from "react";
import type { Course, History, HistoryRecord, HistoryUpdate } from "../types";

const input =
  "glass-input mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";
const button =
  "glass-button rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50";

export function HistoryEditor({
  history,
  courses,
  onSave,
  onCancel,
}: {
  history: History;
  courses: Course[];
  onSave: (payload: HistoryUpdate) => Promise<void>;
  onCancel: () => void;
}) {
  const [startTerm, setStartTerm] = useState(history.start_term ?? "");
  const [currentPeriod, setCurrentPeriod] = useState(
    String(history.current_period),
  );
  const [records, setRecords] = useState<HistoryRecord[]>(history.records);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");

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
            className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
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
                    {course.name}
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
                  })
                }
              >
                <option value="completed">Aprovada</option>
                <option value="in_progress">Cursando</option>
                <option value="failed">Reprovada</option>
              </select>
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
