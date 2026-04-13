"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useStudentAuth } from "@/app/providers";

function StudentAuthGateFallback() {
  return (
    <div
      className="flex min-h-full flex-1 flex-col items-center justify-center bg-background px-4"
      aria-busy="true"
      aria-label="Checking student authentication"
    >
      <p className="text-sm text-muted">Loading…</p>
    </div>
  );
}

/**
 * Renders children only when a Supabase student session exists. Stable loading UI until
 * auth is known; unauthenticated users go to `/login` with a safe `next` return path.
 */
export function RequireStudentAuth({ children }: { children: React.ReactNode }) {
  const { user, isStudentAuthLoading } = useStudentAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isStudentAuthLoading) return;
    if (!user) {
      const next = encodeURIComponent(pathname);
      router.replace(`/login?next=${next}`);
    }
  }, [user, isStudentAuthLoading, router, pathname]);

  if (isStudentAuthLoading) {
    return <StudentAuthGateFallback />;
  }

  if (!user) {
    return <StudentAuthGateFallback />;
  }

  return <>{children}</>;
}
