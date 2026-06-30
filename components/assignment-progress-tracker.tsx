"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useStudentBrowserClient } from "@/lib/supabase/use-student-browser-client";

interface TrackerTask {
  id: string;
  title: string;
  sort_order: number;
}

interface TrackerProgressItem {
  task_id: string;
  team_id: string;
  completed_at: string | null;
}

interface TrackerTeam {
  id: string;
  name: string;
}

interface AssignmentProgressTrackerProps {
  classId?: string;
  assignmentId: string;
  mode: "student" | "educator";
  teamId?: string | null;
  teamName?: string | null;
  teams?: TrackerTeam[];
  className?: string;
}

function completionPercent(completedCount: number, totalCount: number) {
  if (totalCount === 0) return 0;
  return Math.round((completedCount / totalCount) * 100);
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message || fallback;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return fallback;
}

export function AssignmentProgressTracker({
  classId,
  assignmentId,
  mode,
  teamId,
  teamName,
  teams = [],
  className = "",
}: AssignmentProgressTrackerProps) {
  const supabase = useStudentBrowserClient();
  const [tasks, setTasks] = useState<TrackerTask[]>([]);
  const [progressItems, setProgressItems] = useState<TrackerProgressItem[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTracker = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (mode === "student" && !teamId) {
        setTasks([]);
        setProgressItems([]);
        return;
      }

      const tasksQuery = supabase
        .from("assignment_progress_tasks")
        .select("id, title, sort_order")
        .eq("assignment_id", assignmentId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      const progressQuery = supabase
        .from("team_progress_items")
        .select("task_id, team_id, completed_at")
        .eq("assignment_id", assignmentId)
        .order("created_at", { ascending: true });

      const [tasksResult, progressResult] = await Promise.all([
        tasksQuery,
        mode === "student" && teamId ? progressQuery.eq("team_id", teamId) : progressQuery,
      ]);

      if (tasksResult.error) {
        throw tasksResult.error;
      }

      if (progressResult.error) {
        throw progressResult.error;
      }

      setTasks((tasksResult.data || []) as TrackerTask[]);
      setProgressItems((progressResult.data || []) as TrackerProgressItem[]);
    } catch (fetchError) {
      console.error("Error loading progress tracker:", fetchError);
      const message = getErrorMessage(fetchError, "Failed to load tracker");
      setError(
        message.includes("public.assignment_progress_tasks") ||
        message.includes("schema cache")
          ? `${message} If you just added the tracker migration, run it in Supabase and reload the schema cache.`
          : message,
      );
    } finally {
      setIsLoading(false);
    }
  }, [assignmentId, mode, supabase, teamId]);

  useEffect(() => {
    void loadTracker();
  }, [loadTracker]);

  const progressLookup = useMemo(() => {
    const map = new Map<string, TrackerProgressItem>();
    progressItems.forEach((item) => {
      map.set(`${item.team_id}:${item.task_id}`, item);
    });
    return map;
  }, [progressItems]);

  const currentTeamCompleted = tasks.filter((task) => {
    if (!teamId) return false;
    return !!progressLookup.get(`${teamId}:${task.id}`)?.completed_at;
  }).length;

  const teamSummaries = teams.map((team) => {
    const completedCount = tasks.filter(
      (task) => !!progressLookup.get(`${team.id}:${task.id}`)?.completed_at,
    ).length;
    return {
      ...team,
      completedCount,
      percentComplete: completionPercent(completedCount, tasks.length),
    };
  });

  const handleToggleTask = async (taskId: string, checked: boolean) => {
    if (!teamId || mode !== "student") return;

    try {
      setError(null);
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("Not authenticated");
      }

      const response = await supabase.from("team_progress_items").upsert(
        {
          assignment_id: assignmentId,
          team_id: teamId,
          task_id: taskId,
          completed_at: checked ? new Date().toISOString() : null,
          completed_by: checked ? user.id : null,
        },
        { onConflict: "team_id,task_id" },
      );

      if (response.error) {
        throw response.error;
      }

      await loadTracker();
    } catch (toggleError) {
      console.error("Error updating task progress:", toggleError);
      setError(getErrorMessage(toggleError, "Failed to update task"));
    }
  };

  const handleAddTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const title = newTaskTitle.trim();
    if (!title) return;

    try {
      setIsSavingTask(true);
      setError(null);

      if (!classId) {
        throw new Error("Missing class id for progress tracker.");
      }

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error("You must be signed in to add tasks.");
      }

      const postTask = await fetch(
        `/api/educator/classes/${classId}/assignments/${assignmentId}/progress/tasks`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ title }),
        },
      );

      const payload = await postTask.json().catch(() => ({}));

      if (!postTask.ok) {
        throw new Error(payload.error || "Failed to add task");
      }

      setNewTaskTitle("");
      await loadTracker();
    } catch (saveError) {
      console.error("Error creating progress task:", saveError);
      setError(getErrorMessage(saveError, "Failed to add task"));
    } finally {
      setIsSavingTask(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      setError(null);
      if (!classId) {
        throw new Error("Missing class id for progress tracker.");
      }

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error("You must be signed in to remove tasks.");
      }

      const response = await fetch(
        `/api/educator/classes/${classId}/assignments/${assignmentId}/progress/tasks/${taskId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        },
      );

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Failed to delete task");
      }

      await loadTracker();
    } catch (deleteError) {
      console.error("Error deleting progress task:", deleteError);
      setError(getErrorMessage(deleteError, "Failed to delete task"));
    }
  };

  if (isLoading) {
    return (
      <section className={`${className} rounded-2xl border border-black/10 bg-background p-4 shadow-sm dark:border-white/10`}>
        <div className="flex items-center gap-2 text-sm text-muted">
          <svg
            className="h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Loading progress tracker...
        </div>
      </section>
    );
  }

  return (
    <section className={`${className} rounded-2xl border border-black/10 bg-background p-4 shadow-sm dark:border-white/10`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">Project progress</p>
          <h3 className="text-lg font-semibold text-foreground">Progress tracker</h3>
          <p className="mt-1 text-sm text-muted">
            {mode === "student"
              ? teamName
                ? `Track your team's progress for ${teamName}.`
                : "Track your team's project tasks."
              : "Set project tasks and review team progress across the assignment."}
          </p>
        </div>
        <div className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
          {mode === "student"
            ? `${currentTeamCompleted}/${tasks.length} tasks complete`
            : `${tasks.length} task${tasks.length === 1 ? "" : "s"}`}
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {mode === "educator" ? (
        <form onSubmit={handleAddTask} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            value={newTaskTitle}
            onChange={(event) => setNewTaskTitle(event.target.value)}
            placeholder="Add a new task for every team"
            className="w-full rounded-xl border border-black/10 bg-surface px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/15"
          />
          <button
            type="submit"
            disabled={isSavingTask}
            className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSavingTask ? "Adding..." : "Add task"}
          </button>
        </form>
      ) : null}

      {tasks.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-black/15 bg-black/[0.02] p-4 text-sm text-muted dark:border-white/20 dark:bg-white/[0.03]">
          {mode === "student"
            ? "Your educator has not added any tracker items yet."
            : "Add the first tracker item to start measuring project progress."}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {tasks.map((task) => {
            const completionForCurrentTeam = teamId ? progressLookup.get(`${teamId}:${task.id}`) : undefined;
            const checked = !!completionForCurrentTeam?.completed_at;
            const completedTeamCount = teams.filter(
              (team) => !!progressLookup.get(`${team.id}:${task.id}`)?.completed_at,
            ).length;

            return (
              <div
                key={task.id}
                className="rounded-xl border border-black/5 bg-surface px-3 py-3 dark:border-white/10"
              >
                <div className="flex items-start gap-3">
                  {mode === "student" ? (
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => void handleToggleTask(task.id, event.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-black/20 text-brand focus:ring-brand dark:border-white/20"
                    />
                  ) : null}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={`text-sm font-medium text-foreground ${checked ? "line-through opacity-70" : ""}`}>
                        {task.title}
                      </p>
                      {mode === "educator" ? (
                        <span className="rounded-full bg-black/[0.04] px-2 py-0.5 text-[11px] font-medium text-muted dark:bg-white/[0.06]">
                          {completedTeamCount}/{teams.length} teams complete
                        </span>
                      ) : null}
                    </div>
                    {mode === "student" ? (
                      <p className="mt-1 text-xs text-muted">
                        {checked ? "Marked complete for your team." : "Tick this off when your team finishes it."}
                      </p>
                    ) : null}
                  </div>

                  {mode === "educator" ? (
                    <button
                      type="button"
                      onClick={() => void handleDeleteTask(task.id)}
                      className="rounded-lg border border-black/10 bg-background px-2.5 py-1 text-xs font-medium text-muted transition hover:bg-black/[0.03] dark:border-white/15 dark:hover:bg-white/[0.06]"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {mode === "educator" ? (
        <div className="mt-5">
          <h4 className="text-sm font-semibold text-foreground">Team progress</h4>
          {teams.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No teams have been generated yet.</p>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {teamSummaries.map((team) => (
                <div key={team.id} className="rounded-xl border border-black/5 bg-surface p-3 dark:border-white/10">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{team.name}</p>
                      <p className="text-xs text-muted">
                        {team.completedCount}/{tasks.length} tasks complete
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-brand">{team.percentComplete}%</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${team.percentComplete}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
