class CurriculumGraph:
    def __init__(self, courses):
        self.courses = {course["id"]: course for course in courses}
        self.children = {course_id: set() for course_id in self.courses}
        for course in courses:
            self.require_known(set(course["prerequisite_ids"]))
            for prerequisite in course["prerequisite_ids"]:
                self.children[prerequisite].add(course["id"])
        # Eliminação topológica detecta ciclos sem depender de limite de recursão.
        degrees = {c["id"]: len(c["prerequisite_ids"]) for c in courses}
        ready = [course_id for course_id, degree in degrees.items() if degree == 0]
        visited = 0
        while ready:
            visited += 1
            for child in self.children[ready.pop()]:
                degrees[child] -= 1
                if degrees[child] == 0:
                    ready.append(child)
        if visited != len(self.courses):
            raise ValueError("A grade curricular contém um ciclo de pré-requisitos.")

    def require_known(self, course_ids):
        if unknown := course_ids - self.courses.keys():
            raise ValueError(f"Disciplina desconhecida: {', '.join(sorted(unknown))}.")

    def missing(self, course_id, completed):
        return [p for p in self.courses[course_id]["prerequisite_ids"] if p not in completed]

    def descendants(self, course_id):
        found, pending = set(), list(self.children[course_id])
        while pending:
            current = pending.pop()
            if current not in found:
                found.add(current)
                pending.extend(self.children[current])
        return found
