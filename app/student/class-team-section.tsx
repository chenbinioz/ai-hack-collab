"use client";

import { useState, useEffect } from "react";
import { TeamHub } from "@/components/team-hub";
import { PostProjectSkillUpdateForm } from "./post-project-skill-update-form";

interface ClassInfo {
  id: string;
  name: string;
  description: string;
  code: string;
}

interface Assignment {
  id: string;
  class_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  ideal_team_size: number;
  team_id: string | null;
}

interface ClassTeamSectionProps {
  classId: string;
  classInfo?: ClassInfo | null;
}

function formatCountdown(dueDate: string | null | undefined): string {
  if (!dueDate) return "No due date set";

  const target = new Date(dueDate).getTime();
  if (Number.isNaN(target)) return "Invalid due date";

  const diff = target - Date.now();
  if (diff <= 0) return "Due date has passed";

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / (24 * 3600));
  const hours = Math.floor((totalSeconds % (24 * 3600)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${days}d ${hours}h ${minutes}m ${seconds}s remaining`;
}

function isDueDatePassed(dueDate: string | null | undefined): boolean {
  if (!dueDate) return false;
  const target = new Date(dueDate).getTime();
  return !Number.isNaN(target) && target - Date.now() <= 0;
}

function AssignmentSection({
  assignment,
  classId,
}: {
  assignment: Assignment;
  classId: string;
}) {
  const [countdownText, setCountdownText] = useState(formatCountdown(assignment.due_date));
  const [dueDatePassed, setDueDatePassed] = useState(isDueDatePassed(assignment.due_date));
  const [attachments, setAttachments] = useState<
    Array<{
      id: string;
      file_name: string;
      mime_type: string;
      size_bytes: number;
      download_url: string | null;
    }>
  >([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(true);

  useEffect(() => {
    const tick = () => {
      setCountdownText(formatCountdown(assignment.due_date));
      setDueDatePassed(isDueDatePassed(assignment.due_date));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [assignment.due_date]);

  useEffect(() => {
    void (async () => {
      try {
        setAttachmentsLoading(true);
        const response = await fetch(
          `/api/student/classes/${classId}/assignments/${assignment.id}/attachments`,
        );
        const payload = await response.json();
        if (response.ok) {
          setAttachments(payload.attachments ?? []);
        }
      } catch {
        // Non-fatal: resources section simply stays empty
      } finally {
        setAttachmentsLoading(false);
      }
    })();
  }, [assignment.id, classId]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="rounded-2xl border border-black/10 bg-surface p-6 shadow-sm dark:border-white/10">
      <h3 className="text-lg font-semibold text-foreground">{assignment.title}</h3>
      {assignment.description ? (
        <p className="mt-1 text-sm text-muted">{assignment.description}</p>
      ) : null}

      {!attachmentsLoading && attachments.length > 0 && (
        <div className="mt-4 rounded-xl border border-black/10 bg-background p-4 dark:border-white/15">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Resources from your educator
          </p>
          <ul className="mt-3 space-y-2">
            {attachments.map((attachment) => (
              <li key={attachment.id}>
                {attachment.download_url ? (
                  <a
                    href={attachment.download_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-3 rounded-lg border border-black/5 px-3 py-2 text-sm transition hover:bg-black/[0.02] dark:border-white/10 dark:hover:bg-white/[0.04]"
                  >
                    <span className="truncate font-medium text-brand">{attachment.file_name}</span>
                    <span className="shrink-0 text-xs text-muted">
                      {formatFileSize(attachment.size_bytes)}
                    </span>
                  </a>
                ) : (
                  <span className="text-sm text-muted">{attachment.file_name} (unavailable)</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-2 flex items-center gap-4 text-xs text-muted">
        <span>Ideal team size: {assignment.ideal_team_size}</span>
      </div>
      <div className="mt-3 rounded-xl border border-black/10 bg-background px-3 py-2 text-sm dark:border-white/15">
        <p className="text-xs uppercase tracking-wide text-muted">Due date</p>
        <p className="mt-1 font-medium text-foreground">
          {assignment.due_date
            ? new Date(assignment.due_date).toLocaleString()
            : "Not set"}
        </p>
        <p className="mt-1 text-brand">{countdownText}</p>
      </div>

      {dueDatePassed && (
        <div className="mt-4 animate-in fade-in slide-in-from-bottom-2">
          <PostProjectSkillUpdateForm assignmentId={assignment.id} />
        </div>
      )}

      <TeamHub assignmentId={assignment.id} classId={classId} className="mt-6" />
    </div>
  );
}

export function ClassTeamSection({ classId, classInfo: initialClassInfo = null }: ClassTeamSectionProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(initialClassInfo);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  useEffect(() => {
    setClassInfo(initialClassInfo);
  }, [initialClassInfo]);

  useEffect(() => {
    void fetchClassTeamData();
  }, [classId]);

  const fetchClassTeamData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!initialClassInfo || initialClassInfo.id !== classId) {
        const classResponse = await fetch("/api/student/classes", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        const classPayload = await classResponse.json();

        if (!classResponse.ok) {
          throw new Error(classPayload.error || "Class not found");
        }

        const currentClass = (classPayload.classes || []).find((c: ClassInfo) => c.id === classId);
        if (!currentClass) {
          throw new Error("Class not found");
        }

        setClassInfo(currentClass);
      }

      const assignmentsResponse = await fetch(`/api/student/classes/${classId}/assignments`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      const assignmentsPayload = await assignmentsResponse.json();

      if (!assignmentsResponse.ok) {
        throw new Error(assignmentsPayload.error || "Failed to fetch assignments");
      }

      setAssignments(assignmentsPayload.assignments || []);
    } catch (err: unknown) {
      console.error("Error fetching class team data:", err);
      const message = err instanceof Error ? err.message : "Failed to load team information";
      setError(message);
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
            Loading your assignments...
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm dark:border-red-800 dark:bg-red-950/30 sm:p-8">
        <h2 className="text-lg font-semibold text-red-900 dark:text-red-100">Class assignments</h2>
        <p className="mt-2 text-sm text-red-700 dark:text-red-300">
          Error loading class information: {error}
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-black/10 bg-surface p-6 shadow-sm dark:border-white/10">
        <h2 className="text-xl font-semibold text-foreground">{classInfo?.name}</h2>
        <p className="mt-1 text-sm text-muted">{classInfo?.description}</p>
        <div className="mt-2 flex items-center gap-4 text-xs text-muted">
          <span>
            Class Code:{" "}
            <code className="rounded bg-black/5 px-1 py-0.5 dark:bg-white/10">{classInfo?.code}</code>
          </span>
        </div>
      </div>

      {assignments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/15 bg-black/[0.02] p-8 text-center dark:border-white/20 dark:bg-white/[0.03]">
          <h3 className="text-sm font-medium text-foreground">No assignments yet</h3>
          <p className="mt-2 text-sm text-muted">
            Your educator has not published any assignments for this class yet.
          </p>
        </div>
      ) : (
        assignments.map((assignment) => (
          <AssignmentSection key={assignment.id} assignment={assignment} classId={classId} />
        ))
      )}
    </section>
  );
}
