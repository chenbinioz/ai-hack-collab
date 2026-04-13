"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStudentAuth } from "@/app/providers";

export function StudentHomeView() {
  const router = useRouter();
  const { user, isStudentAuthLoading, signOutStudent } = useStudentAuth();
  const [isStudentSigningOut, setIsStudentSigningOut] = useState(false);

  const meta = user?.user_metadata;
  const displayName =
    (typeof meta?.full_name === "string" && meta.full_name.trim()) ||
    (typeof meta?.name === "string" && meta.name.trim()) ||
    user?.email?.split("@")[0] ||
    "Student";

  async function handleStudentLogout() {
    setIsStudentSigningOut(true);
    try {
      await signOutStudent();
      router.replace("/login");
      router.refresh();
    } catch {
      setIsStudentSigningOut(false);
    }
  }

  if (isStudentAuthLoading || !user) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center px-4">
        <p className="text-sm text-muted">Loading your space…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      <header className="border-b border-black/5 px-4 py-4 dark:border-white/10 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand">Student space</p>
            <p className="text-sm font-semibold text-foreground">Cohort Connect</p>
          </div>
          <button
            type="button"
            onClick={() => void handleStudentLogout()}
            disabled={isStudentSigningOut}
            className="rounded-xl border border-black/10 bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:hover:bg-white/[0.06]"
          >
            {isStudentSigningOut ? "Signing out…" : "Log out"}
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Welcome, {displayName}</h1>
        <p className="mt-3 max-w-xl text-muted">
          This is your signed-in student home. More tools for cohorts, groups, and coursework will appear here
          soon.
        </p>
        <div className="mt-10 rounded-2xl border border-dashed border-black/15 bg-black/[0.02] p-8 text-center dark:border-white/20 dark:bg-white/[0.04]">
          <p className="text-sm text-muted">Placeholder — upcoming features</p>
        </div>
      </main>
    </div>
  );
}
