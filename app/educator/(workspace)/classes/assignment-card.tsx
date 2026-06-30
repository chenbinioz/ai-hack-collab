"use client";

import { useState, useEffect } from "react";
import { getPublicBackendUrl } from "@/lib/api/public-backend-url";
import { useStudentBrowserClient } from "@/lib/supabase/use-student-browser-client";
import { FeedbackAnalyticsPanel } from "@/app/educator/(workspace)/survey-results/feedback-analytics-panel";
import { buildTeamSizeReport, countMembersPerTeam } from "@/lib/teams/ideal-size";
import { MatchingFocusPreferencesPicker } from "@/components/matching-focus-preferences-picker";
import { SkillPreferencesPicker } from "@/components/skill-preferences-picker";
import {
  normalizeAiPreferences,
  type AiPreferences,
} from "@/lib/matching/skill-preferences";
import { AssignmentAttachmentsPanel } from "./assignment-attachments-panel";
import { AssignmentProgressTracker } from "@/components/assignment-progress-tracker";
import {
  DraftTeamsBoard,
  type DraftTeam,
  type StudentStats,
} from "./[classId]/draft-teams-board";

export interface Assignment {
  id: string;
  class_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  ideal_team_size: number;
  ai_preferences: AiPreferences;
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
  studentNames: Record<string, string>;
  enrolledStudentCount: number;
  drafts?: DraftTeam[];
  studentsMap?: Record<string, StudentStats>;
  expectedDraftMemberCount?: number;
  onSwapDraft?: (studentId: string, fromDraftId: string, toDraftId: string, reason: string) => Promise<void>;
  onPublishDraftTeams?: () => Promise<void>;
  onRefresh: (options?: { silent?: boolean }) => void | Promise<void>;
  onTeamsUpdated?: (
    assignmentId: string,
    teams: Team[],
    teamMembers: Array<{ student_id: string; team_id: string; assignment_id: string }>,
  ) => void;
}

function formatGenerateTeamsError(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const record = payload as { error?: unknown; detail?: unknown };
  if (typeof record.error === "string" && record.error.trim()) {
    return record.error;
  }
  if (typeof record.detail === "string" && record.detail.trim()) {
    return record.detail;
  }
  if (record.detail && typeof record.detail === "object") {
    const detail = record.detail as { error?: unknown };
    if (typeof detail.error === "string" && detail.error.trim()) {
      return detail.error;
    }
  }

  return fallback;
}

function formatFetchFailure(err: unknown, fallback: string, backendUrl?: string): string {
  if (!(err instanceof Error)) {
    return fallback;
  }

  const message = err.message || fallback;
  if (
    message === "Load failed" ||
    message === "Failed to fetch" ||
    message.includes("NetworkError")
  ) {
    const target = backendUrl ?? getPublicBackendUrl();
    return `Could not reach the team generation service at ${target}. Check that the Render backend is running, or set NEXT_PUBLIC_API_URL in your environment.`;
  }

  return message;
}

async function postGenerateTeams(
  classId: string,
  assignmentId: string,
  accessToken: string,
): Promise<Response> {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
  const timeoutSignal = AbortSignal.timeout(5 * 60 * 1000);
  const directUrl = `${getPublicBackendUrl()}/educator/classes/${classId}/assignments/${assignmentId}/generate-teams`;

  try {
    return await fetch(directUrl, {
      method: "POST",
      headers,
      signal: timeoutSignal,
    });
  } catch (directError) {
    const proxyUrl = `/api/educator/classes/${classId}/assignments/${assignmentId}/generate-teams`;
    try {
      return await fetch(proxyUrl, {
        method: "POST",
        headers,
        signal: timeoutSignal,
      });
    } catch {
      throw directError;
    }
  }
}

const factorLabelMap: Record<string, string> = {
  deadline_preference: "Deadline management",
  discussion_preference: "Discussion style",
  critical_feedback_preference: "Comfort with critical feedback",
  disagreement_preference: "Conflict handling",
  new_concepts_preference: "Openness to new concepts",
  teammate_work_preference: "Preferred work distribution",
  deadline_working_pattern: "Deadline work rhythm",
  external_analytics: "External learning analytics",
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

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message || fallback;
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message?: unknown }).message ?? fallback);
  }
  return fallback;
}

export function SurveyTable({ responses }: { responses: SurveyResponse[] }) {
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
  studentNames,
  enrolledStudentCount,
  drafts = [],
  studentsMap = {},
  expectedDraftMemberCount,
  onSwapDraft,
  onPublishDraftTeams,
  onRefresh,
  onTeamsUpdated,
}: AssignmentCardProps) {
  const supabase = useStudentBrowserClient();

  const [dueDateInput, setDueDateInput] = useState(
    assignment.due_date ? new Date(assignment.due_date).toISOString().slice(0, 16) : "",
  );
  const [idealTeamSize, setIdealTeamSize] = useState(assignment.ideal_team_size);
  const [aiPreferences, setAiPreferences] = useState(() =>
    normalizeAiPreferences(assignment.ai_preferences),
  );
  const [isSavingDueDate, setIsSavingDueDate] = useState(false);
  const [isSavingTeamSettings, setIsSavingTeamSettings] = useState(false);
  const [isGeneratingTeams, setIsGeneratingTeams] = useState(false);
  const [isResettingTeams, setIsResettingTeams] = useState(false);
  const [generationSizeReport, setGenerationSizeReport] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDueDateInput(
      assignment.due_date ? new Date(assignment.due_date).toISOString().slice(0, 16) : "",
    );
    setIdealTeamSize(assignment.ideal_team_size);
    setAiPreferences(normalizeAiPreferences(assignment.ai_preferences));
  }, [assignment]);

  const assignmentTeams = teams.filter((team) => team.assignment_id === assignment.id);
  const memberCounts = countMembersPerTeam(teamMemberMap, assignmentTeams);
  const teamSizeReport = buildTeamSizeReport(
    assignmentTeams,
    memberCounts,
    assignment.ideal_team_size,
  );
  const memberCountByTeamId = new Map(
    teamSizeReport.teams.map((entry) => [entry.teamId, entry]),
  );

  const getTeamMemberList = (teamId: string) =>
    [...teamMemberMap.entries()]
      .filter(([, mappedTeamId]) => mappedTeamId === teamId)
      .map(([studentId]) => ({
        id: studentId,
        name: studentNames[studentId] || "Unnamed Student",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

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
      await onRefresh({ silent: true });
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to update due date"));
    } finally {
      setIsSavingDueDate(false);
    }
  };

  const handleSaveTeamSettings = async () => {
    try {
      setIsSavingTeamSettings(true);
      setError(null);
      await patchAssignment({
        ideal_team_size: idealTeamSize,
        ai_preferences: aiPreferences,
      });
      await onRefresh({ silent: true });
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to update team settings"));
    } finally {
      setIsSavingTeamSettings(false);
    }
  };

  const getApiErrorMessage = (payload: any) => {
    if (!payload) {
      return null;
    }

    if (typeof payload.detail === "string") {
      return payload.detail;
    }

    if (payload.detail && typeof payload.detail === "object") {
      return payload.detail.error || payload.detail.redirect_endpoint || JSON.stringify(payload.detail);
    }

    return payload.error || null;
  };

  const handleGenerateTeams = async () => {
    const backendUrl = getPublicBackendUrl();
    try {
      setIsGeneratingTeams(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("You must be signed in to generate teams.");
      }

      // Persist the selected team settings before generating so the backend uses the latest size.
      await patchAssignment({
        ideal_team_size: idealTeamSize,
        ai_preferences: aiPreferences,
      });

      const response = await postGenerateTeams(classId, assignment.id, session.access_token);

      const payload = await response.json().catch(() => ({}));
      const draftTeamIds = Array.isArray(payload?.draft_team_ids) ? payload.draft_team_ids : [];

      if (!response.ok) {
        throw new Error(formatGenerateTeamsError(payload, "Failed to generate teams"));
      }
      if (payload?.error || payload?.detail) {
        throw new Error(formatGenerateTeamsError(payload, "Failed to generate teams"));
      }

      if (Array.isArray(payload?.teams) && Array.isArray(payload?.team_members)) {
        onTeamsUpdated?.(assignment.id, payload.teams, payload.team_members);
      }

      const report = payload?.team_size_report as
        | { all_ideal?: boolean; ideal_team_size?: number; non_ideal_teams?: Array<{ team_index: number; size: number }> }
        | undefined;
      if (report?.all_ideal) {
        setGenerationSizeReport(
          `All teams are at the ideal size (${report.ideal_team_size ?? assignment.ideal_team_size}).`,
        );
      } else if (report?.non_ideal_teams?.length) {
        const ideal = report.ideal_team_size ?? assignment.ideal_team_size;
        const details = report.non_ideal_teams
          .map((entry) => `Team ${entry.team_index} (${entry.size} members)`)
          .join(", ");
        setGenerationSizeReport(
          `${report.non_ideal_teams.length} team${report.non_ideal_teams.length === 1 ? "" : "s"} are not the ideal size (${ideal}): ${details}.`,
        );
      } else if (draftTeamIds.length > 0) {
        setGenerationSizeReport(
          `Generated ${draftTeamIds.length} draft team${draftTeamIds.length === 1 ? "" : "s"}. Review the draft board below and publish when ready.`,
        );
      } else {
        setGenerationSizeReport(null);
      }

      await onRefresh({ silent: true });
    } catch (err: unknown) {
      setError(formatFetchFailure(err, "Failed to generate teams", backendUrl));
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

      setGenerationSizeReport(null);
      await onRefresh({ silent: true });
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to reset teams"));
    } finally {
      setIsResettingTeams(false);
    }
  };

  const updateWantedSkills = (wanted_skills: AiPreferences["wanted_skills"]) => {
    setAiPreferences((prev) => ({
      ...prev,
      wanted_skills,
      focus_skills: wanted_skills.length > 0,
    }));
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

      <AssignmentProgressTracker
        classId={classId}
        assignmentId={assignment.id}
        mode="educator"
        teams={assignmentTeams.map((team) => ({ id: team.id, name: team.name }))}
        className="mt-0"
      />

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
            <label htmlFor={`ideal_team_size_${assignment.id}`} className="block text-sm font-medium text-foreground">
              Ideal team size
            </label>
            <select
              id={`ideal_team_size_${assignment.id}`}
              value={idealTeamSize}
              onChange={(e) => setIdealTeamSize(parseInt(e.target.value))}
              className="mt-1 block w-full max-w-xs rounded-xl border border-black/10 bg-background px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/15"
            >
              {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((size) => (
                <option key={size} value={size}>
                  {size} students
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted">
              Teams will be generated to match this size when possible.
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-foreground">AI matching preferences</p>
            <div className="mt-3 space-y-4">
              <MatchingFocusPreferencesPicker
                preferences={aiPreferences}
                onChange={setAiPreferences}
              />

              <SkillPreferencesPicker
                selected={aiPreferences.wanted_skills}
                onChange={updateWantedSkills}
              />
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

        {assignmentTeams.length > 0 ? (
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-sm font-medium">Teams generated ({assignmentTeams.length} teams)</span>
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

      {generationSizeReport && (
        <p
          className={`rounded-xl border px-3 py-2 text-sm ${
            generationSizeReport.startsWith("All teams")
              ? "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-200"
              : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
          }`}
        >
          {generationSizeReport}
        </p>
      )}

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      )}

      {drafts.length > 0 && onSwapDraft && onPublishDraftTeams ? (
        <div className="rounded-xl border border-black/5 bg-background/50 p-4 dark:border-white/10">
          <DraftTeamsBoard
            classId={classId}
            drafts={drafts}
            studentsMap={studentsMap}
            expectedMemberCount={expectedDraftMemberCount}
            onSwap={onSwapDraft}
            onPublish={onPublishDraftTeams}
          />
        </div>
      ) : null}

      {assignmentTeams.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground">Generated teams</h3>
          {teamSizeReport.summaryText ? (
            <p
              className={`mt-2 rounded-xl border px-3 py-2 text-sm ${
                teamSizeReport.allIdeal
                  ? "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-200"
                  : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
              }`}
            >
              {teamSizeReport.summaryText}
            </p>
          ) : null}
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {assignmentTeams.map((team) => {
              const sizeEntry = memberCountByTeamId.get(team.id);
              const isIdeal = sizeEntry?.isIdeal ?? true;
              return (
              <div
                key={team.id}
                className={`rounded-lg border p-4 ${
                  isIdeal
                    ? "border-black/5 bg-white dark:border-white/10 dark:bg-zinc-900"
                    : "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20"
                }`}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h4 className="font-semibold text-foreground">{team.name}</h4>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      isIdeal
                        ? "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-200"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
                    }`}
                  >
                    {sizeEntry?.size ?? 0} member{(sizeEntry?.size ?? 0) === 1 ? "" : "s"}
                    {!isIdeal ? ` (ideal: ${idealTeamSize})` : ""}
                  </span>
                </div>
                <p className="mb-3 text-sm text-muted">{team.reason}</p>

                {(() => {
                  const members = getTeamMemberList(team.id);
                  return members.length > 0 ? (
                    <div className="mb-3 rounded-xl border border-black/5 bg-background/70 p-3 dark:border-white/10">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Members</p>
                      <ul className="mt-2 space-y-1">
                        {members.map((member) => (
                          <li key={member.id} className="text-sm text-foreground">
                            {member.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="mb-3 text-xs text-muted">No members assigned yet.</p>
                  );
                })()}

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
              );
            })}
          </div>
        </div>
      )}

      <FeedbackAnalyticsPanel classId={classId} assignmentId={assignment.id} />
    </div>
  );
}
