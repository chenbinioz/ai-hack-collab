"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStudentAuth } from "@/app/providers";
import { useStudentProfileSurveyStatus } from "@/lib/hooks/use-student-profile-survey-status";

export function StudentHomeView() {
  const router = useRouter();
  const { user, isStudentAuthLoading, signOutStudent } = useStudentAuth();
  const { isLoading: isSurveyStatusLoading, surveyCompleted } = useStudentProfileSurveyStatus();
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

  if (isStudentAuthLoading || !user || isSurveyStatusLoading) {
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
        <section
          className="mt-10 rounded-2xl border border-black/10 bg-surface p-6 shadow-sm dark:border-white/10 sm:p-8"
          aria-labelledby="student-profile-survey-heading"
        >
          <h2 id="student-profile-survey-heading" className="text-lg font-semibold text-foreground">
            Student profile survey
          </h2>
          <p className="mt-2 text-sm text-muted">
            Tell us how you work so we can place you thoughtfully in cohorts. You only complete this once.
          </p>

          {surveyCompleted ? (
            <div className="mt-6 space-y-3">
              <button
                type="button"
                disabled
                className="w-full cursor-not-allowed rounded-xl border border-black/10 bg-black/[0.04] px-4 py-3 text-left text-sm font-semibold text-muted opacity-70 dark:border-white/15 dark:bg-white/[0.06]"
              >
                Student profile survey
              </button>
              <p className="text-sm text-muted">
                You have already submitted your profile survey. Your answers are final and cannot be changed.
              </p>
            </div>
          ) : (
            <div className="mt-6">
              <Link
                href="/student/survey"
                className="flex w-full items-center justify-center rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-deep"
              >
                Complete the student profile survey
              </Link>
            </div>
          )}
        </section>

        <div className="mt-10 rounded-2xl border border-dashed border-black/15 bg-black/[0.02] p-8 text-center dark:border-white/20 dark:bg-white/[0.04]">
          <p className="text-sm text-muted">Placeholder — upcoming features</p>
        </div>
      </main>
    </div>
  );
}
