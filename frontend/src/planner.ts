import type { Course } from "./types";

/**
 * "Montar meu próximo semestre": escolhe disciplinas liberadas até uma carga
 * desejada. A prioridade segue a ideia do caminho crítico (list scheduling):
 * primeiro o que segura a maior cadeia de obrigatórias pendentes, depois o que
 * está atrasado e o que libera mais disciplinas.
 */
export interface Pick {
  course: Course;
  reasons: string[];
  /** Semestres de cadeia que ainda dependem desta disciplina (ela inclusa). */
  height: number;
}
export interface Suggestion {
  picks: Pick[];
  hours: number;
  electiveHours: number;
  leftOut: { course: Course; reason: string }[];
}
export interface Options {
  budget: number;
  includeElectives: boolean;
  /** Aprovadas + em andamento (consideradas aprovadas ao fim do semestre). */
  assumed: Set<string>;
  /** Período em que a sugestão será cursada. */
  period: number;
  /** Horas de eletivas de perfil que ainda faltam. */
  profileRemaining: number;
}

const isDone = (c: Course, assumed: Set<string>) => assumed.has(c.id);

/** Altura de cada obrigatória pendente: a maior cadeia que começa nela. */
export function chainHeights(courses: Course[], assumed: Set<string>) {
  const pending = courses.filter(
    (c) => c.type === "mandatory" && !isDone(c, assumed),
  );
  const ids = new Set(pending.map((c) => c.id));
  const children = new Map<string, string[]>();
  for (const c of pending)
    for (const parent of c.prerequisite_ids)
      if (ids.has(parent))
        children.set(parent, [...(children.get(parent) ?? []), c.id]);
  const height = new Map<string, number>();
  const visit = (id: string): number => {
    const known = height.get(id);
    if (known !== undefined) return known;
    const value = 1 + Math.max(0, ...(children.get(id) ?? []).map(visit));
    height.set(id, value);
    return value;
  };
  pending.forEach((c) => visit(c.id));
  return height;
}

export function suggestSemester(
  courses: Course[],
  options: Options,
): Suggestion {
  const { assumed, budget, period } = options;
  const byId = new Map(courses.map((c) => [c.id, c]));
  const heights = chainHeights(courses, assumed);
  const longest = Math.max(0, ...heights.values());
  const direct = new Map<string, number>();
  for (const c of courses)
    for (const parent of c.prerequisite_ids)
      direct.set(parent, (direct.get(parent) ?? 0) + 1);
  const unlocked = (c: Course) =>
    !isDone(c, assumed) &&
    c.failure_level !== "refused" &&
    c.prerequisite_ids.every((id) => assumed.has(id));
  const candidates = courses.filter(
    (c) => unlocked(c) && (c.type === "mandatory" || options.includeElectives),
  );
  const score = (c: Course) => [
    c.type === "mandatory" ? 0 : 1,
    -(heights.get(c.id) ?? 0),
    c.type === "mandatory" && (c.period ?? 99) < period ? 0 : 1,
    -(direct.get(c.id) ?? 0),
    c.period ?? 99,
  ];
  candidates.sort((a, b) => {
    const x = score(a);
    const y = score(b);
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i];
    return a.name.localeCompare(b.name, "pt-BR");
  });

  const chosen = new Set<string>();
  const picks: Pick[] = [];
  const leftOut: Suggestion["leftOut"] = [];
  let hours = 0;
  let electiveHours = 0;
  for (const course of candidates) {
    if (chosen.has(course.id)) continue;
    // Co-requisitos entram juntos, no mesmo semestre.
    const group = [
      course,
      ...(course.corequisite_ids ?? [])
        .filter((id) => !assumed.has(id) && !chosen.has(id))
        .map((id) => byId.get(id)!)
        .filter(Boolean),
    ];
    const blocked = group.find((c) => c !== course && !unlocked(c));
    if (blocked) {
      leftOut.push({
        course,
        reason: `Co-requisito ${blocked.short_name} ainda não liberado.`,
      });
      continue;
    }
    const groupHours = group.reduce((sum, c) => sum + c.hours, 0);
    const groupElective = group
      .filter((c) => c.type === "elective")
      .reduce((sum, c) => sum + c.hours, 0);
    if (hours + groupHours > budget) {
      leftOut.push({ course, reason: `Não coube na carga de ${budget}h.` });
      continue;
    }
    if (
      groupElective &&
      electiveHours + groupElective > options.profileRemaining
    ) {
      leftOut.push({
        course,
        reason: "As eletivas de perfil necessárias já estão cobertas.",
      });
      continue;
    }
    for (const c of group) {
      chosen.add(c.id);
      const height = heights.get(c.id) ?? 0;
      const reasons: string[] = [];
      if (c.type === "mandatory" && height === longest && longest > 1)
        reasons.push("Caminho crítico");
      if (c.type === "mandatory" && (c.period ?? 99) < period)
        reasons.push(`Atrasada · ${c.period}º período`);
      if ((direct.get(c.id) ?? 0) > 0)
        reasons.push(
          `Libera ${direct.get(c.id)} disciplina${direct.get(c.id)! > 1 ? "s" : ""}`,
        );
      if (c !== course) reasons.push(`Co-requisito de ${course.short_name}`);
      if (c.type === "elective") reasons.push("Eletiva de perfil");
      else if (!reasons.length) reasons.push(`Do ${c.period}º período`);
      picks.push({ course: c, reasons, height });
    }
    hours += groupHours;
    electiveHours += groupElective;
  }
  return { picks, hours, electiveHours, leftOut };
}

export interface Semester {
  index: number;
  picks: Pick[];
  mandatoryHours: number;
  electiveHours: number;
}

/**
 * Um caminho possível até a formatura: repete a sugestão semestre a semestre,
 * considerando aprovado o que foi escolhido. Com `includeElectives`, escolhe
 * eletivas de perfil liberadas; sem isso, as eletivas entram só como horas.
 */
export function projectSemesters(
  courses: Course[],
  options: Omit<Options, "includeElectives"> & { includeElectives?: boolean },
  limit = 16,
) {
  const assumed = new Set(options.assumed);
  let profile = options.profileRemaining;
  const semesters: Semester[] = [];
  for (let index = 0; index < limit; index++) {
    const pending = courses.some(
      (c) => c.type === "mandatory" && !assumed.has(c.id),
    );
    if (!pending && profile <= 0) break;
    const {
      picks,
      hours,
      electiveHours: chosen,
    } = suggestSemester(courses, {
      ...options,
      assumed,
      period: options.period + index,
      includeElectives: !!options.includeElectives,
      profileRemaining: options.includeElectives ? profile : 0,
    });
    profile -= chosen;
    // O que não coube em eletivas de verdade fica como horas a escolher.
    const electiveHours = Math.min(
      profile,
      Math.max(0, options.budget - hours),
    );
    if (!picks.length && !electiveHours) {
      // Sobram só disciplinas presas (recusa de matrícula ou dados incompletos).
      return { semesters, stuck: true };
    }
    picks.forEach((p) => assumed.add(p.course.id));
    profile -= electiveHours;
    semesters.push({
      index,
      picks,
      mandatoryHours: hours - chosen,
      electiveHours: electiveHours + chosen,
    });
  }
  return { semesters, stuck: false };
}

/**
 * Quando um plano forma: o último semestre com disciplina planejada, desde que
 * todas as obrigatórias pendentes e as horas de eletivas de perfil tenham semestre.
 */
export function planCompletion(plan: {
  courses: Course[];
  planned_ids: string[];
  course_layout: Record<string, { period: number }>;
  forecast?: { remaining_profile_elective_hours: number } | null;
}) {
  const planned = new Set(plan.planned_ids);
  const pending = plan.courses.filter(
    (c) =>
      c.type === "mandatory" &&
      !["completed", "simulated", "in_progress"].includes(c.status),
  );
  const unscheduled = pending.filter((c) => !planned.has(c.id));
  const periodOf = (c: Course) =>
    plan.course_layout[c.id]?.period ?? c.period ?? 0;
  const plannedCourses = plan.courses.filter((c) => planned.has(c.id));
  const electiveHours = plannedCourses
    .filter((c) => c.type === "elective")
    .reduce((sum, c) => sum + c.hours, 0);
  const missingElectiveHours = Math.max(
    0,
    (plan.forecast?.remaining_profile_elective_hours ?? 0) - electiveHours,
  );
  const lastPeriod = Math.max(0, ...plannedCourses.map(periodOf));
  return {
    lastPeriod: lastPeriod || null,
    unscheduled: unscheduled.length,
    missingElectiveHours,
    complete: !unscheduled.length && !missingElectiveHours && lastPeriod > 0,
  };
}
