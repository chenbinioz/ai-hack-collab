import { createBrowserClient } from "@supabase/ssr";
import { getStudentSupabaseAnonKey, getStudentSupabaseUrl } from "@/lib/supabase/student-env";

/**
 * Browser client for student auth + Postgres (RLS). Session is stored in cookies
 * via @supabase/ssr (PKCE, auto-refresh) — do not persist tokens manually.
 */
export function createStudentBrowserClient() {
  return createBrowserClient(getStudentSupabaseUrl(), getStudentSupabaseAnonKey());
}
