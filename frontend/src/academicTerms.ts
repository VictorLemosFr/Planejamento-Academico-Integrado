import type { Course, HistoryRecord } from "./types";

/** Semestre letivo de um período, contando a partir do ingresso (2025.1 + 1 = 2025.2). */
export function termOf(startTerm: string, period: number) {
  const [year, half] = startTerm.split(".").map(Number);
  const index = year * 2 + (half - 1) + (period - 1);
  return `${Math.floor(index / 2)}.${(index % 2) + 1}`;
}

export function periodOf(startTerm: string, term: string) {
  const [y0, h0] = startTerm.split(".").map(Number);
  const [y1, h1] = term.split(".").map(Number);
  return y1 * 2 + h1 - (y0 * 2 + h0) + 1;
}

/** Semestres do ingresso até o atual, para escolher o semestre de cada tentativa. */
export function termsUntil(startTerm: string, currentPeriod: number) {
  return Array.from({ length: currentPeriod }, (_, i) =>
    termOf(startTerm, i + 1),
  );
}

/** Eletivas registradas no histórico aparecem no período da tentativa mais recente. */
export function historyLayout(
  courses: Course[],
  records: HistoryRecord[],
  startTerm: string,
) {
  const layout: Record<string, { period: number; order: number }> = {};
  const electives = new Set(
    courses.filter((c) => c.type === "elective").map((c) => c.id),
  );
  const latest = new Map<string, string>();
  for (const record of records) {
    if (!electives.has(record.course_id)) continue;
    const previous = latest.get(record.course_id);
    if (!previous || previous < record.academic_term)
      latest.set(record.course_id, record.academic_term);
  }
  const orders = new Map<number, number>();
  for (const [id, term] of [...latest].sort()) {
    const period = Math.max(1, periodOf(startTerm, term));
    const order = orders.get(period) ?? 2000;
    layout[id] = { period, order };
    orders.set(period, order + 1);
  }
  return layout;
}

export const formatGrade = (grade: number | null | undefined) =>
  grade === null || grade === undefined
    ? "—"
    : grade.toLocaleString("pt-BR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 2,
      });
