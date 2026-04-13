"use client";

import { hasStudentSupabaseEnv } from "@/lib/supabase/student-env";

/** Shown on auth screens when Supabase env is not configured so localhost still loads. */
export function SupabaseEnvMissingBanner() {
  if (hasStudentSupabaseEnv()) return null;

  return (
    <p
      className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100"
      role="status"
    >
      Supabase is not configured. Add <code className="rounded bg-black/10 px-1 py-0.5 text-xs dark:bg-white/10">SUPABASE_URL</code> and{" "}
      <code className="rounded bg-black/10 px-1 py-0.5 text-xs dark:bg-white/10">SUPABASE_ANON_KEY</code> to{" "}
      <code className="rounded bg-black/10 px-1 py-0.5 text-xs dark:bg-white/10">.env</code> (see{" "}
      <code className="rounded bg-black/10 px-1 py-0.5 text-xs dark:bg-white/10">.env.example</code>), then restart{" "}
      <code className="rounded bg-black/10 px-1 py-0.5 text-xs dark:bg-white/10">npm run dev</code>.
    </p>
  );
}
