"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useStudentAuth } from "@/app/providers";
import { createStudentBrowserClient } from "@/lib/supabase/student-browser-client";
import { hasStudentSupabaseEnv } from "@/lib/supabase/student-env";

function EducatorAuthGateFallback() {
  return (
    <div
      className="flex min-h-full flex-1 flex-col items-center justify-center bg-background px-4"
      aria-busy="true"
      aria-label="Checking educator authentication"
    >
      <p className="text-sm text-muted">Loading…</p>
    </div>
  );
}

/**
 * Requires a Supabase session and a `teacher_profiles` row (same check as educator sign-in).
 */
export function RequireEducatorAuth({ children }: { children: React.ReactNode }) {
  const { user, isStudentAuthLoading } = useStudentAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [teacherVerified, setTeacherVerified] = useState(false);

  useEffect(() => {
    if (isStudentAuthLoading) return;

    if (!user) {
      setTeacherVerified(false);
      const next = encodeURIComponent(pathname);
      router.replace(`/login/educator?next=${next}`);
      return;
    }

    setTeacherVerified(false);

    if (!hasStudentSupabaseEnv()) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const supabase = createStudentBrowserClient();
        const { data, error } = await supabase.rpc("teacher_profile_exists", { p_user_id: user.id });
        if (cancelled) return;
        if (error || data !== true) {
          await supabase.auth.signOut({ scope: "global" });
          const next = encodeURIComponent(pathname);
          router.replace(`/login/educator?next=${next}`);
          return;
        }
        setTeacherVerified(true);
      } catch {
        if (cancelled) return;
        try {
          const supabase = createStudentBrowserClient();
          await supabase.auth.signOut({ scope: "global" });
        } catch {
          /* ignore */
        }
        const next = encodeURIComponent(pathname);
        router.replace(`/login/educator?next=${next}`);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, isStudentAuthLoading, router, pathname]);

  if (isStudentAuthLoading || !user) {
    return <EducatorAuthGateFallback />;
  }

  if (!hasStudentSupabaseEnv() || !teacherVerified) {
    return <EducatorAuthGateFallback />;
  }

  return <>{children}</>;
}
