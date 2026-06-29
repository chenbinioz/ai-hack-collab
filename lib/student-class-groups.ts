export interface StudentClass {
  id: string;
  name: string;
  description: string;
  code: string;
  enrolled_at: string;
  role: string;
}

export interface StudentClassGroup {
  id: string;
  name: string;
  description: string;
  classes: StudentClass[];
}

export function groupStudentClasses(classes: StudentClass[]): StudentClassGroup[] {
  const groups = new Map<string, StudentClassGroup>();

  for (const cls of classes) {
    const key = cls.name.trim().toLowerCase();
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, {
        id: `group:${key}`,
        name: cls.name,
        description: cls.description,
        classes: [cls],
      });
      continue;
    }

    existing.classes.push(cls);
  }

  for (const group of groups.values()) {
    group.classes.sort(
      (a, b) => new Date(b.enrolled_at).getTime() - new Date(a.enrolled_at).getTime(),
    );
    group.description = group.classes[0].description;
  }

  return Array.from(groups.values());
}

export function findStudentClassGroup(
  groups: StudentClassGroup[],
  tabId: string,
): StudentClassGroup | undefined {
  if (tabId.startsWith("group:")) {
    return groups.find((group) => group.id === tabId);
  }

  return groups.find((group) => group.classes.some((cls) => cls.id === tabId));
}

export function isDueDatePassed(dueDate: string | null | undefined): boolean {
  if (!dueDate) return false;
  const target = new Date(dueDate).getTime();
  return !Number.isNaN(target) && target - Date.now() <= 0;
}

export function pickDefaultAssignmentId<T extends { id: string; due_date: string | null }>(
  assignments: T[],
  preferredId: string | null,
): string | null {
  if (preferredId && assignments.some((assignment) => assignment.id === preferredId)) {
    return preferredId;
  }

  const activeAssignment = assignments.find((assignment) => !isDueDatePassed(assignment.due_date));
  if (activeAssignment) {
    return activeAssignment.id;
  }

  return assignments[0]?.id ?? null;
}

export function getAssignmentTabLabel(
  assignment: { title: string; due_date: string | null },
  assignments: Array<{ title: string; due_date: string | null }>,
  className?: string,
): string {
  const duplicateTitles =
    assignments.filter((item) => item.title === assignment.title).length > 1;
  const matchesClassName =
    !!className &&
    assignment.title.trim().toLowerCase() === className.trim().toLowerCase();

  if (!duplicateTitles && !matchesClassName) {
    return assignment.title;
  }

  if (isDueDatePassed(assignment.due_date)) {
    return `${assignment.title} (Ended)`;
  }

  if (assignment.due_date) {
    return `${assignment.title} (${new Date(assignment.due_date).toLocaleDateString()})`;
  }

  return assignment.title;
}
