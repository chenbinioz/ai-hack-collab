const DEFAULT_STUDENT_AFTER_LOGIN = "/student";
const DEFAULT_EDUCATOR_AFTER_LOGIN = "/educator/survey-results";

/**
 * Allow only same-origin relative paths (avoids open redirects after login).
 */
export function getSafeRedirectPath(
  next: string | null | undefined,
  fallback: string,
): string {
  if (next == null || typeof next !== "string") return fallback;
  const t = next.trim();
  if (!t.startsWith("/") || t.startsWith("//")) return fallback;
  return t;
}

export function getSafeStudentRedirectPath(
  next: string | null | undefined,
  fallback: string = DEFAULT_STUDENT_AFTER_LOGIN,
): string {
  return getSafeRedirectPath(next, fallback);
}

export function getSafeEducatorRedirectPath(
  next: string | null | undefined,
  fallback: string = DEFAULT_EDUCATOR_AFTER_LOGIN,
): string {
  return getSafeRedirectPath(next, fallback);
}
