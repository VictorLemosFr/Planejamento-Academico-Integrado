import type { Course, CourseLayout } from "./types";

export function coursePeriod(course: Course, layout: CourseLayout) {
  return layout[course.id]?.period ?? course.period;
}

export function orderedCourses(
  courses: Course[],
  layout: CourseLayout,
  period: number | null,
) {
  return courses
    .filter((c) => coursePeriod(c, layout) === period)
    .sort(
      (a, b) => (layout[a.id]?.order ?? 1000) - (layout[b.id]?.order ?? 1000),
    );
}

export function moveCourse(
  courses: Course[],
  layout: CourseLayout,
  id: string,
  period: number | null,
  beforeId?: string,
): CourseLayout {
  const course = courses.find((c) => c.id === id);
  if (
    !course ||
    (period === null && course.type !== "elective") ||
    (period !== null &&
      (!Number.isInteger(period) || period < 1 || period > 20)) ||
    beforeId === id
  )
    return layout;
  const result = { ...layout };
  delete result[id];
  if (period === null) return result;
  const target = orderedCourses(courses, layout, period).filter(
    (c) => c.id !== id,
  );
  const index = beforeId ? target.findIndex((c) => c.id === beforeId) : -1;
  target.splice(index < 0 ? target.length : index, 0, course);
  target.forEach((c, order) => {
    result[c.id] = { period, order };
  });
  return result;
}

export function placementWarning(
  course: Course,
  courses: Course[],
  layout: CourseLayout,
) {
  const period = coursePeriod(course, layout);
  if (period === null || ["completed", "simulated"].includes(course.status))
    return false;
  return course.prerequisite_ids.some((id) => {
    const prerequisite = courses.find((c) => c.id === id);
    if (
      !prerequisite ||
      ["completed", "simulated"].includes(prerequisite.status)
    )
      return false;
    const before = coursePeriod(prerequisite, layout);
    return before === null || before >= period;
  });
}
