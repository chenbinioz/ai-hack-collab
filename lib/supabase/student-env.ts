/**
 * Supabase configuration for the student app. Values come only from environment
 * variables (never hardcode URL or anon key in source).
 *
 * `next.config.ts` copies `SUPABASE_URL` / `SUPABASE_ANON_KEY` into
 * `NEXT_PUBLIC_*` for client and Edge bundles.
 */
export function hasStudentSupabaseEnv(): boolean {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    "";
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim() ||
    "";
  return Boolean(url && key);
}

export function getStudentSupabaseUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    "";
  if (!url) {
    throw new Error(
      "Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL). Add it to .env — see .env.example.",
    );
  }
  return url;
}

export function getStudentSupabaseAnonKey(): string {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim() ||
    "";
  if (!key) {
    throw new Error(
      "Missing SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY). Add it to .env — see .env.example.",
    );
  }
  return key;
}
