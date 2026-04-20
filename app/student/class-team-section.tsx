"use client";

import { useState, useEffect } from "react";
import { createStudentBrowserClient } from "@/lib/supabase/student-browser-client";
import { TeamHub } from "@/components/team-hub";

interface ClassTeamSectionProps {
  classId: string;
  classInfo?: {
    id: string;
    name: string;
    description: string;
    code: string;
    coursework_deadline?: string | null;
    max_team_size: number;
  } | null;
}

function formatCountdown(deadline: string | null | undefined): string {
  if (!deadline) return "No coursework deadline set";

  const target = new Date(deadline).getTime();
  if (Number.isNaN(target)) return "Invalid coursework deadline";

  const diff = target - Date.now();
  if (diff <= 0) return "Coursework deadline has passed";

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / (24 * 3600));
  const hours = Math.floor((totalSeconds % (24 * 3600)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${days}d ${hours}h ${minutes}m ${seconds}s remaining`;
}

export function ClassTeamSection({ classId, classInfo: initialClassInfo = null }: ClassTeamSectionProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [classInfo, setClassInfo] = useState<any>(initialClassInfo);
  const [countdownText, setCountdownText] = useState("No coursework deadline set");
  const supabase = createStudentBrowserClient();

  useEffect(() => {
    setClassInfo(initialClassInfo);
  }, [initialClassInfo]);

  useEffect(() => {
    fetchClassTeamData();
  }, [classId]);

  useEffect(() => {
    const tick = () => {
      setCountdownText(formatCountdown(classInfo?.coursework_deadline));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [classInfo?.coursework_deadline]);

  const fetchClassTeamData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("Not authenticated");
      }

      // Ensure class header information is available via API fallback.
      if (!initialClassInfo || initialClassInfo.id !== classId) {
        const classResponse = await fetch("/api/student/classes", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        const classPayload = await classResponse.json();

        if (!classResponse.ok) {
          throw new Error(classPayload.error || "Class not found");
        }

        const currentClass = (classPayload.classes || []).find((c: any) => c.id === classId);
        if (!currentClass) {
          throw new Error("Class not found");
        }

        setClassInfo(currentClass);
      }

    } catch (err: any) {
      console.error('Error fetching class team data:', err);
      setError(err.message || 'Failed to load team information');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <section className="rounded-2xl border border-black/10 bg-surface p-6 shadow-sm dark:border-white/10 sm:p-8">
        <div className="flex items-center justify-center py-8">
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
            Loading your team...
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm dark:border-red-800 dark:bg-red-950/30 sm:p-8">
        <h2 className="text-lg font-semibold text-red-900 dark:text-red-100">Team Hub</h2>
        <p className="mt-2 text-sm text-red-700 dark:text-red-300">
          Error loading team information: {error}
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      {/* Class Header */}
      <div className="rounded-2xl border border-black/10 bg-surface p-6 shadow-sm dark:border-white/10">
        <h2 className="text-xl font-semibold text-foreground">{classInfo?.name}</h2>
        <p className="mt-1 text-sm text-muted">{classInfo?.description}</p>
        <div className="mt-2 flex items-center gap-4 text-xs text-muted">
          <span>Class Code: <code className="rounded bg-black/5 px-1 py-0.5 dark:bg-white/10">{classInfo?.code}</code></span>
          <span>Max Team Size: {classInfo?.max_team_size}</span>
        </div>
        <div className="mt-3 rounded-xl border border-black/10 bg-background px-3 py-2 text-sm dark:border-white/15">
          <p className="text-xs uppercase tracking-wide text-muted">Coursework deadline</p>
          <p className="mt-1 font-medium text-foreground">
            {classInfo?.coursework_deadline
              ? new Date(classInfo.coursework_deadline).toLocaleString()
              : "Not set"}
          </p>
          <p className="mt-1 text-brand">{countdownText}</p>
        </div>
      </div>

      <TeamHub classId={classId} />
    </section>
  );
}