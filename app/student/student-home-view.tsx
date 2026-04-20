"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useStudentAuth } from "@/app/providers";
import { useStudentProfileSurveyStatus } from "@/lib/hooks/use-student-profile-survey-status";
import { TeamHub } from "@/components/team-hub";
import { StudentSkillsVisualization } from "./student-skills-visualization";
import { JoinClassSection } from "./join-class-section";
import { ClassTeamSection } from "./class-team-section";

interface StudentClass {
  id: string;
  name: string;
  description: string;
  code: string;
  coursework_deadline: string | null;
  enrolled_at: string;
  role: string;
  max_team_size: number;
  ai_preferences: any;
}

type TabType = "overview" | "skills" | string; // Allow class IDs as tabs

export function StudentHomeView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isStudentAuthLoading, signOutStudent } = useStudentAuth();
  const { isLoading: isSurveyStatusLoading, surveyCompleted } = useStudentProfileSurveyStatus();
  const [isStudentSigningOut, setIsStudentSigningOut] = useState(false);
  const [classes, setClasses] = useState<StudentClass[]>([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);
  const [classesError, setClassesError] = useState<string | null>(null);

  // Get active tab from URL params, default to overview
  const activeTab: TabType = searchParams.get("tab") || "overview";

  const meta = user?.user_metadata;
  const displayName =
    (typeof meta?.full_name === "string" && meta.full_name.trim()) ||
    (typeof meta?.name === "string" && meta.name.trim()) ||
    user?.email?.split("@")[0] ||
    "Student";

  // Fetch student's classes
  useEffect(() => {
    if (user) {
      fetchStudentClasses();
    }
  }, [user]);

  const fetchStudentClasses = async () => {
    try {
      setIsLoadingClasses(true);
      setClassesError(null);
      const response = await fetch("/api/student/classes", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (!response.ok) {
        setClassesError(data.error || "Could not load your classes.");
        return;
      }

      setClasses(data.classes || []);
    } catch (error) {
      console.error("Error fetching student classes:", error);
      setClassesError("Unable to load your classes right now.");
    } finally {
      setIsLoadingClasses(false);
    }
  };

  async function handleStudentLogout() {
    setIsStudentSigningOut(true);
    try {
      await signOutStudent();
      router.replace("/");
      router.refresh();
    } catch {
      setIsStudentSigningOut(false);
    }
  }

  function handleTabChange(tab: TabType) {
    const params = new URLSearchParams(searchParams);
    if (tab === "overview") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    router.replace(`/student?${params.toString()}`, { scroll: false });
  }

  // Get available tabs (overview, skills, and each class)
  const availableTabs = [
    { id: "overview", label: "Overview" },
    { id: "skills", label: "Skills" },
    ...classes.map(cls => ({ id: cls.id, label: cls.name }))
  ];

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
          This is your signed-in student home. View your classes, teams, and profile information.
        </p>

        {/* Tab Navigation */}
        <div className="mt-8 border-b border-black/10 dark:border-white/10">
          <nav className="flex space-x-8 overflow-x-auto">
            {availableTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-brand text-brand"
                    : "border-transparent text-muted hover:text-foreground hover:border-black/20"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="mt-8">
          {activeTab === "overview" && (
            <>
              <section
                className="mb-10 rounded-2xl border border-black/10 bg-surface p-6 shadow-sm dark:border-white/10 sm:p-8"
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

              <JoinClassSection onClassJoined={fetchStudentClasses} />

              {/* Your Classes Section */}
              <section
                className="rounded-2xl border border-black/10 bg-surface p-6 shadow-sm dark:border-white/10 sm:p-8"
                aria-labelledby="your-classes-heading"
              >
                <h2 id="your-classes-heading" className="text-lg font-semibold text-foreground">
                  Your Classes
                </h2>
                <p className="mt-2 text-sm text-muted">
                  Classes you've joined and your team assignments.
                </p>

                {isLoadingClasses ? (
                  <div className="mt-6 flex items-center justify-center py-8">
                    <div className="flex items-center gap-2 text-muted">
                      <svg
                        className="h-5 w-5 animate-spin"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Loading your classes...
                    </div>
                  </div>
                ) : classesError ? (
                  <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
                    {classesError}
                  </div>
                ) : classes.length === 0 ? (
                  <div className="mt-6 rounded-xl border border-dashed border-black/15 bg-black/[0.02] p-8 text-center dark:border-white/20 dark:bg-white/[0.03]">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand/10">
                      <svg
                        className="h-6 w-6 text-brand"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="1.5"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                        />
                      </svg>
                    </div>
                    <h3 className="mt-4 text-sm font-medium text-foreground">No classes yet</h3>
                    <p className="mt-2 text-sm text-muted">
                      Join your first class using the code provided by your educator.
                    </p>
                  </div>
                ) : (
                  <div className="mt-6 space-y-4">
                    {classes.map((cls) => (
                      <div
                        key={cls.id}
                        className="rounded-xl border border-black/10 bg-white p-4 transition hover:bg-black/[0.02] dark:border-white/15 dark:bg-zinc-900 dark:hover:bg-white/[0.02]"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-medium text-foreground">{cls.name}</h3>
                            <p className="mt-1 text-sm text-muted">{cls.description}</p>
                            <div className="mt-2 flex items-center gap-4 text-xs text-muted">
                              <span>Class Code: <code className="rounded bg-black/5 px-1 py-0.5 dark:bg-white/10">{cls.code}</code></span>
                              <span>Max Team Size: {cls.max_team_size}</span>
                              <span>
                                Deadline: {cls.coursework_deadline ? new Date(cls.coursework_deadline).toLocaleDateString() : "Not set"}
                              </span>
                              <span>Joined {new Date(cls.enrolled_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleTabChange(cls.id)}
                            className="ml-4 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-deep"
                          >
                            View Details
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

            </>
          )}

          {activeTab === "skills" && (
            <div className="space-y-8">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-foreground">Skills Visualization</h2>
                <p className="mt-2 text-muted">View your skills profile pictorially</p>
              </div>

              {!surveyCompleted ? (
                <div className="rounded-2xl border border-black/10 bg-surface p-8 shadow-sm dark:border-white/10 text-center">
                  <p className="text-muted mb-4">Complete your profile survey to see your skills visualization.</p>
                  <Link
                    href="/student/survey"
                    className="inline-flex items-center justify-center rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-deep"
                  >
                    Complete Survey
                  </Link>
                </div>
              ) : (
                <StudentSkillsVisualization />
              )}
            </div>
          )}

          {/* Class-specific tabs */}
          {classes.find(cls => cls.id === activeTab) && (
            <ClassTeamSection
              classId={activeTab}
              classInfo={classes.find((cls) => cls.id === activeTab) || null}
            />
          )}
        </div>
      </main>
    </div>
  );
}
