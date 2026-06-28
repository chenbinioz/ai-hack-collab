"use client";

import { useState, useEffect } from "react";
import { createStudentBrowserClient } from "@/lib/supabase/student-browser-client";
import { FeedbackAnalyticsPanel } from "@/app/educator/(workspace)/survey-results/feedback-analytics-panel";
import { AssignmentAttachmentsPanel } from "./assignment-attachments-panel";

export interface Assignment {
  id: string;
  class_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  max_team_size: number;
  ai_preferences: {
    focus_skills: boolean;
    focus_working_style: boolean;
    focus_availability: boolean;
    balance_diversity: boolean;
  };
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface Team {
  id: string;
  name: string;
  reason: string;
  created_at: string;
  assignment_id?: string | null;
  match_explanation?: {
    factor_weights?: Record<string, number>;
    match_trace?: Array<{
      factor?: string;
      label?: string;
      evidence?: string;
      weight?: number;
    }>;
  } | null;
}

export interface SurveyResponse {
  student_id: string;
  name: string;
  email: string | null;
  enrolled_at: string;
  survey_completed: boolean;
  profile_survey_completed_at: string | null;
  survey_degree_title: string | null;
  survey_year: number | null;
  survey_ancillary_module: string | null;
  survey_confidence_coding: number | null;
  survey_confidence_written_reports: number | null;
  survey_confidence_presentation_public_speaking: number | null;
  survey_confidence_mathematical_literacy: number | null;
  survey_confidence_abstract_complex_content: number | null;
  survey_confidence_conflict_resolution: number | null;
  survey_approach_deadline: number | null;
  survey_approach_discussion: number | null;
  survey_approach_disagreement: number | null;
  survey_approach_new_concepts: number | null;
  survey_approach_communication: number | null;
  survey_approach_teammate_work: number | null;
  survey_approach_heavy_workload: number | null;
  survey_approach_group_project_role: number | null;
  survey_approach_critical_feedback: number | null;
}

interface AssignmentCardProps {
  assignment: Assignment;
  classId: string;
  teams: Team[];
  teamMemberMap: Map<string, string>;
  surveyResponses: SurveyResponse[];
  enrolledStudentCount: number;
  onRefresh: () => void;
}

const API_BASE_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:8000"
    : process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const factorLabelMap: Record<string, string> = {
  deadline_preference: "Deadline management",
  discussion_preference: "Discussion style",
  critical_feedback_preference: "Comfort with critical feedback",
  disagreement_preference: "Conflict handling",
  new_concepts_preference: "Openness to new concepts",
  teammate_work_preference: "Preferred work distribution",
  deadline_working_pattern: "Deadline work rhythm",
};

function formatFactorLabel(factor: string) {
  return (
    factorLabelMap[factor] ??
    factor
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

function sortedFactorWeights(weights?: Record<string, number>) {
  if (!weights) return [];
  return Object.entries(weights)
    .filter((entry) => Number.isFinite(entry[1]))
    .sort((a, b) => b[1] - a[1]);
}

function SurveyTable({ responses }: { responses: SurveyResponse[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] border-collapse text-left">
        <thead>
          <tr>
            {["Student", "Submitted", "Degree", "Year", "Ancillary module", "Code confidence", "Workload", "Feedback readiness"].map(
              (header) => (
                <th
                  key={header}
                  className="border-b border-black/10 bg-black/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted dark:border-white/10 dark:bg-white/[0.06]"
                >
                  {header}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-black/6 dark:divide-white/10">
          {responses.map((response) => (
            <tr
              key={response.student_id}
              className="bg-background/50 transition-colors hover:bg-black/[0.03] dark:bg-transparent dark:hover:bg-white/[0.04]"
            >
              <td className="px-3 py-3 text-sm text-foreground">
                <div className="font-medium">{response.name}</div>
                <div className="text-xs text-muted">{response.email || "—"}</div>
              </td>
              <td className="px-3 py-3 text-sm text-muted">
                {response.profile_survey_completed_at
                  ? new Date(response.profile_survey_completed_at).toLocaleDateString()
                  : "—"}
              </td>
              <td className="px-3 py-3 text-sm text-muted">{response.survey_degree_title || "—"}</td>
              <td className="px-3 py-3 text-sm text-muted">{response.survey_year ?? "—"}</td>
              <td className="px-3 py-3 text-sm text-muted">{response.survey_ancillary_module || "—"}</td>
              <td className="px-3 py-3 text-sm text-muted">{response.survey_confidence_coding ?? "—"}</td>
              <td className="px-3 py-3 text-sm text-muted">{response.survey_approach_heavy_workload ?? "—"}</td>
              <td className="px-3 py-3 text-sm text-muted">{response.survey_approach_critical_feedback ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AssignmentCard({
  assignment,
  classId,
  teams,
  teamMemberMap,
  surveyResponses,
  enrolledStudentCount,
  onRefresh,
}: AssignmentCardProps) {
  const supabase = createStudentBrowserClient();

  const [dueDateInput, setDueDateInput] = useState(
    assignment.due_date ? new Date(assignment.due_date).toISOString().slice(0, 16) : "",
  );
  const [maxTeamSize, setMaxTeamSize] = useState(assignment.max_team_size);
  const [aiPreferences, setAiPreferences] = useState(assignment.ai_preferences);
  const [isSavingDueDate, setIsSavingDueDate] = useState(false);
  const [isSavingTeamSettings, setIsSavingTeamSettings] = useState(false);
  const [isGeneratingTeams, setIsGeneratingTeams] = useState(false);
  const [isResettingTeams, setIsResettingTeams] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDueDateInput(
      assignment.due_date ? new Date(assignment.due_date).toISOString().slice(0, 16) : "",
    );
    setMaxTeamSize(assignment.max_team_size);
    setAiPreferences(assignment.ai_preferences);
  }, [assignment]);

  const completedResponses = surveyResponses.filter((response) => response.survey_completed);

  const responsesWithTeam = completedResponses.map((response) => ({
    ...response,
    team_id: teamMemberMap.get(response.student_id) ?? null,
  }));

  const completedGroupedByTeam = responsesWithTeam.reduce((groups, response) => {
    const key = response.team_id ?? "__ungrouped";
    const current = groups.get(key) ?? [];
    current.push(response);
    groups.set(key, current);
    return groups;
  }, new Map<string, typeof responsesWithTeam>());

  const groupedTeams = teams.map((team) => ({
    id: team.id,
    name: team.name,
    responses: completedGroupedByTeam.get(team.id) ?? [],
  }));
  const ungroupedResponses = completedGroupedByTeam.get("__ungrouped") ?? [];

  const patchAssignment = async (updates: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error("You must be signed in to update this assignment.");
    }

    const response = await fetch(
      `/api/educator/classes/${classId}/assignments/${assignment.id}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      },
    );

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Failed to update assignment");
    }
  };

  const handleSaveDueDate = async () => {
    try {
      setIsSavingDueDate(true);
      setError(null);
      await patchAssignment({ due_date: dueDateInput || null });
      onRefresh();
    } catch (err: any) {
      setError(err.message || "Failed to update due date");
    } finally {
      setIsSavingDueDate(false);
    }
  };

  const handleSaveTeamSettings = async () => {
    try {
      setIsSavingTeamSettings(true);
      setError(null);
      await patchAssignment({
        max_team_size: maxTeamSize,
        ai_preferences: aiPreferences,
      });
      onRefresh();
    } catch (err: any) {
      setError(err.message || "Failed to update team settings");
    } finally {
      setIsSavingTeamSettings(false);
    }
  };

  const handleGenerateTeams = async () => {
    try {
      setIsGeneratingTeams(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("You must be signed in to generate teams.");
      }

      const response = await fetch(
        `${API_BASE_URL}/educator/classes/${classId}/assignments/${assignment.id}/generate-teams`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        },
      );

      const payload = await response.json().catch(() => ({}));
      if (payload?.error || payload?.detail) {
        throw new Error(payload.detail || payload.error);
      }
      if (!response.ok) {
        throw new Error(payload?.detail || payload?.error || "Failed to generate teams");
      }

      onRefresh();
    } catch (err: any) {
      setError(err.message || "Failed to generate teams");
    } finally {
      setIsGeneratingTeams(false);
    }
  };

  const handleResetTeams = async () => {
    try {
      setIsResettingTeams(true);
      setError(null);

      const { error: deleteError } = await supabase
        .from("teams")
        .delete()
        .eq("assignment_id", assignment.id);

      if (deleteError) {
        throw deleteError;
      }

      onRefresh();
    } catch (err: any) {
      setError(err.message || "Failed to reset teams");
    } finally {
      setIsResettingTeams(false);
    }
  };

  const updatePreference = (key: keyof Assignment["ai_preferences"], value: boolean) => {
    setAiPreferences((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6 rounded-2xl border border-black/10 bg-surface p-6 shadow-sm dark:border-white/10">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{assignment.title}</h2>
        {assignment.description ? (
          <p className="mt-1 text-sm text-muted">{assignment.description}</p>
        ) : null}
      </div>

      <div className="rounded-xl border border-black/5 bg-background/50 p-4 dark:border-white/10">
        <AssignmentAttachmentsPanel
          classId={classId}
          assignmentId={assignment.id}
          mode="manage"
        />
      </div>

      <div className="flex flex-col gap-3 sm:max-w-md">
        <label htmlFor={`due_date_${assignment.id}`} className="text-sm font-medium text-foreground">
          Due date
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id={`due_date_${assignment.id}`}
            type="datetime-local"
            value={dueDateInput}
            onChange={(e) => setDueDateInput(e.target.value)}
            className="w-full rounded-xl border border-black/10 bg-background px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/15"
          />
          <button
            onClick={handleSaveDueDate}
            disabled={isSavingDueDate}
            className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSavingDueDate ? "Saving..." : "Save due date"}
          </button>
        </div>
        <p className="text-xs text-muted">Students will see this as a countdown for this assignment.</p>
      </div>

      <div className="rounded-xl border border-black/5 bg-background/50 p-4 dark:border-white/10">
        <h3 className="text-sm font-semibold text-foreground">Team settings</h3>
        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor={`max_team_size_${assignment.id}`} className="block text-sm font-medium text-foreground">
              Maximum team size
            </label>
            <select
              id={`max_team_size_${assignment.id}`}
              value={maxTeamSize}
              onChange={(e) => setMaxTeamSize(parseInt(e.target.value))}
              className="mt-1 block w-full max-w-xs rounded-xl border border-black/10 bg-background px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/15"
            >
              {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((size) => (
                <option key={size} value={size}>
                  {size} students
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-sm font-medium text-foreground">AI matching preferences</p>
            <div className="mt-3 space-y-2">
              {[
                { key: "focus_skills" as const, label: "Skill complementarity" },
                { key: "focus_working_style" as const, label: "Working style compatibility" },
                { key: "focus_availability" as const, label: "Schedule compatibility" },
                { key: "balance_diversity" as const, label: "Balance team diversity" },
              ].map(({ key, label }) => (
                <label key={key} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={aiPreferences[key]}
                    onChange={(e) => updatePreference(key, e.target.checked)}
                    className="h-4 w-4 rounded border-black/20 text-brand focus:ring-brand dark:border-white/20"
                  />
                  <span className="text-sm text-foreground">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={handleSaveTeamSettings}
            disabled={isSavingTeamSettings}
            className="rounded-xl border border-black/10 bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-black/[0.03] dark:border-white/15 dark:hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSavingTeamSettings ? "Saving..." : "Save team settings"}
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground">Team generation</h3>
        <p className="mt-1 text-sm text-muted">
          Generate AI-matched teams for this assignment based on student survey responses.
        </p>

        {teams.length > 0 ? (
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-sm font-medium">Teams generated ({teams.length} teams)</span>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={handleGenerateTeams}
                disabled={isGeneratingTeams}
                className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isGeneratingTeams ? "Regenerating..." : "Regenerate Teams"}
              </button>
              <button
                onClick={handleResetTeams}
                disabled={isResettingTeams}
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50"
              >
                {isResettingTeams ? "Resetting..." : "Reset Teams"}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={handleGenerateTeams}
            disabled={isGeneratingTeams || enrolledStudentCount < 2}
            className="mt-4 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isGeneratingTeams ? "Generating..." : "Generate AI Teams"}
          </button>
        )}

        {enrolledStudentCount < 2 && (
          <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
            Need at least 2 students enrolled to generate teams.
          </p>
        )}
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      )}

      {teams.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground">Generated teams</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {teams.map((team) => (
              <div
                key={team.id}
                className="rounded-lg border border-black/5 bg-white p-4 dark:border-white/10 dark:bg-zinc-900"
              >
                <h4 className="mb-2 font-semibold text-foreground">{team.name}</h4>
                <p className="mb-3 text-sm text-muted">{team.reason}</p>

                {team.match_explanation?.factor_weights ? (
                  <div className="mb-4 rounded-xl border border-black/5 bg-background/70 p-3 dark:border-white/10">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">Factor weights</p>
                    <div className="mt-3 space-y-2">
                      {sortedFactorWeights(team.match_explanation.factor_weights).map(([factor, weight]) => {
                        const percentage = Math.max(0, Math.min(100, Math.round(weight * 100)));
                        return (
                          <div key={factor}>
                            <div className="mb-1 flex items-center justify-between text-xs text-muted">
                              <span>{formatFactorLabel(factor)}</span>
                              <span>{percentage}%</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                              <div
                                className="h-full rounded-full bg-brand"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {team.match_explanation?.match_trace && team.match_explanation.match_trace.length > 0 ? (
                  <div className="mb-3 rounded-xl border border-black/5 bg-background/70 p-3 dark:border-white/10">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">Why matched trace</p>
                    <ul className="mt-2 space-y-2">
                      {team.match_explanation.match_trace.map((trace, index) => (
                        <li
                          key={`${team.id}-trace-${index}`}
                          className="rounded-lg bg-black/[0.03] px-2.5 py-2 text-xs text-foreground dark:bg-white/[0.05]"
                        >
                          <span className="font-semibold">
                            {trace.label
                              ? formatFactorLabel(trace.label)
                              : trace.factor
                                ? formatFactorLabel(trace.factor)
                                : `Signal ${index + 1}`}
                            :
                          </span>{" "}
                          {trace.evidence || "No detailed evidence provided."}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <p className="text-xs text-muted">Created {new Date(team.created_at).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Survey responses</h3>
            <p className="mt-1 text-sm text-muted">Profile survey answers grouped by team for this assignment.</p>
          </div>
          <p className="text-sm text-muted">
            {completedResponses.length} of {surveyResponses.length} completed
          </p>
        </div>

        {completedResponses.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-black/15 bg-black/[0.02] p-6 text-center dark:border-white/20 dark:bg-white/[0.03]">
            <p className="text-sm text-muted">No completed surveys yet for this class.</p>
          </div>
        ) : teams.length > 0 ? (
          <div className="mt-4 space-y-4">
            {groupedTeams.map((teamGroup) =>
              teamGroup.responses.length > 0 ? (
                <section
                  key={teamGroup.id}
                  className="overflow-hidden rounded-2xl border border-black/6 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-950"
                >
                  <div className="flex items-center justify-between gap-4 border-b border-black/10 bg-black/[0.04] px-4 py-3 dark:border-white/10 dark:bg-white/[0.06]">
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">{teamGroup.name}</h4>
                      <p className="text-xs text-muted">Team members with completed surveys</p>
                    </div>
                    <p className="text-sm text-muted">{teamGroup.responses.length} completed</p>
                  </div>
                  <SurveyTable responses={teamGroup.responses} />
                </section>
              ) : null,
            )}
            {ungroupedResponses.length > 0 && (
              <section className="overflow-hidden rounded-2xl border border-black/6 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-950">
                <div className="flex items-center justify-between gap-4 border-b border-black/10 bg-black/[0.04] px-4 py-3 dark:border-white/10 dark:bg-white/[0.06]">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">Ungrouped students</h4>
                    <p className="text-xs text-muted">Completed surveys without a team for this assignment</p>
                  </div>
                  <p className="text-sm text-muted">{ungroupedResponses.length} completed</p>
                </div>
                <SurveyTable responses={ungroupedResponses} />
              </section>
            )}
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-2xl border border-black/6 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-950">
            <SurveyTable responses={completedResponses} />
          </div>
        )}
      </div>

      <FeedbackAnalyticsPanel classId={classId} assignmentId={assignment.id} />
    </div>
  );
}
