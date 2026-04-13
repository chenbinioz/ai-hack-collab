const DEFAULT_STUDENT_AFTER_LOGIN = "/student";

/**
 * Allow only same-origin relative paths (avoids open redirects after student login).
 */
export function getSafeStudentRedirectPath(
  next: string | null | undefined,
  fallback: string = DEFAULT_STUDENT_AFTER_LOGIN,
): string {
  if (next == null || typeof next !== "string") return fallback;
  const t = next.trim();
  if (!t.startsWith("/") || t.startsWith("//")) return fallback;
  return t;
}
