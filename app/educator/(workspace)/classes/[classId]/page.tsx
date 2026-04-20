"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createStudentBrowserClient } from "@/lib/supabase/student-browser-client";
import { FeedbackAnalyticsPanel } from "@/app/educator/(workspace)/survey-results/feedback-analytics-panel";

interface ClassDetails {
  id: string;
  name: string;
  description: string;
  code: string;
  coursework_deadline: string | null;
  max_team_size: number;
  ai_preferences: any;
  student_count: number;
  created_at: string;
}

interface EnrolledStudent {
  id: string;
  survey_name: string | null;
  enrolled_at: string;
  survey_completed: boolean;
}

interface Team {
  id: string;
  name: string;
  reason: string;
  created_at: string;
}

interface SurveyResponse {
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
  team_id: string | null;
}

export default function ClassManagementPage() {
  const params = useParams();
  const router = useRouter();
  const classId = params.classId as string;

  const [classDetails, setClassDetails] = useState<ClassDetails | null>(null);
  const [enrolledStudents, setEnrolledStudents] = useState<EnrolledStudent[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [surveyResponses, setSurveyResponses] = useState<SurveyResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isResettingTeams, setIsResettingTeams] = useState(false);
  const [isGeneratingTeams, setIsGeneratingTeams] = useState(false);
  const [isSavingDeadline, setIsSavingDeadline] = useState(false);
  const [deadlineInput, setDeadlineInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const completedResponses = surveyResponses.filter((response) => response.survey_completed);

  const teamMap = new Map(teams.map((team) => [team.id, team.name]));
  const completedGroupedByTeam = completedResponses.reduce((groups, response) => {
    const key = response.team_id ?? "__ungrouped";
    const current = groups.get(key) ?? [];
    current.push(response);
    groups.set(key, current);
    return groups;
  }, new Map<string, SurveyResponse[]>());

  const groupedTeams = teams.map((team) => ({
    id: team.id,
    name: team.name,
    responses: completedGroupedByTeam.get(team.id) ?? [],
  }));
  const ungroupedResponses = completedGroupedByTeam.get("__ungrouped") ?? [];

  const supabase = createStudentBrowserClient();
  const API_BASE_URL = process.env.NODE_ENV === "development"
    ? "http://localhost:8000"
    : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000");

  useEffect(() => {
    if (classId) {
      fetchClassData();
    }
  }, [classId]);

  const fetchClassData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login/educator");
        return;
      }

      // Fetch class details
      const response = await fetch("/api/educator/classes", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch classes");
      }

      const data = await response.json();
      const classInfo = data.classes.find((c: ClassDetails) => c.id === classId);

      if (!classInfo) {
        throw new Error("Class not found");
      }

      setClassDetails(classInfo);
      setDeadlineInput(
        classInfo.coursework_deadline
          ? new Date(classInfo.coursework_deadline).toISOString().slice(0, 16)
          : ""
      );

      // Fetch enrolled students and survey responses for this class
      const { data: enrollmentData, error: enrollmentError } = await supabase
        .from("class_enrollments")
        .select(`
          student_id,
          enrolled_at,
          role,
          student_profiles!inner(
            id,
            email,
            survey_name,
            profile_survey_completed_at,
            survey_degree_title,
            survey_year,
            survey_alevel_or_equivalent_titles,
            survey_ancillary_module,
            survey_confidence_coding,
            survey_confidence_written_reports,
            survey_confidence_presentation_public_speaking,
            survey_confidence_mathematical_literacy,
            survey_confidence_abstract_complex_content,
            survey_confidence_conflict_resolution,
            survey_approach_deadline,
            survey_approach_discussion,
            survey_approach_disagreement,
            survey_approach_new_concepts,
            survey_approach_communication,
            survey_approach_teammate_work,
            survey_approach_heavy_workload,
            survey_approach_group_project_role,
            survey_approach_critical_feedback
            ,team_id
          )
        `)
        .eq("class_id", classId)
        .order("enrolled_at", { ascending: false });

      if (enrollmentError) {
        console.error("Error fetching enrollments:", enrollmentError);
      } else {
        const students = enrollmentData.map((enrollment: any) => ({
          id: enrollment.student_profiles.id,
          survey_name: enrollment.student_profiles.survey_name,
          enrolled_at: enrollment.enrolled_at,
          survey_completed: enrollment.student_profiles.profile_survey_completed_at !== null,
        }));

        const responses = enrollmentData.map((enrollment: any) => ({
          student_id: enrollment.student_profiles.id,
          name: enrollment.student_profiles.survey_name || "Unnamed Student",
          email: enrollment.student_profiles.email,
          enrolled_at: enrollment.enrolled_at,
          survey_completed: enrollment.student_profiles.profile_survey_completed_at !== null,
          profile_survey_completed_at: enrollment.student_profiles.profile_survey_completed_at,
          survey_degree_title: enrollment.student_profiles.survey_degree_title,
          survey_year: enrollment.student_profiles.survey_year,
          survey_ancillary_module: enrollment.student_profiles.survey_ancillary_module,
          survey_confidence_coding: enrollment.student_profiles.survey_confidence_coding,
          survey_confidence_written_reports: enrollment.student_profiles.survey_confidence_written_reports,
          survey_confidence_presentation_public_speaking: enrollment.student_profiles.survey_confidence_presentation_public_speaking,
          survey_confidence_mathematical_literacy: enrollment.student_profiles.survey_confidence_mathematical_literacy,
          survey_confidence_abstract_complex_content: enrollment.student_profiles.survey_confidence_abstract_complex_content,
          survey_confidence_conflict_resolution: enrollment.student_profiles.survey_confidence_conflict_resolution,
          survey_approach_deadline: enrollment.student_profiles.survey_approach_deadline,
          survey_approach_discussion: enrollment.student_profiles.survey_approach_discussion,
          survey_approach_disagreement: enrollment.student_profiles.survey_approach_disagreement,
          survey_approach_new_concepts: enrollment.student_profiles.survey_approach_new_concepts,
          survey_approach_communication: enrollment.student_profiles.survey_approach_communication,
          survey_approach_teammate_work: enrollment.student_profiles.survey_approach_teammate_work,
          survey_approach_heavy_workload: enrollment.student_profiles.survey_approach_heavy_workload,
          survey_approach_group_project_role: enrollment.student_profiles.survey_approach_group_project_role,
          survey_approach_critical_feedback: enrollment.student_profiles.survey_approach_critical_feedback,
          team_id: enrollment.student_profiles.team_id,
        }));

        setEnrolledStudents(students);
        setSurveyResponses(responses);
      }

      // Fetch teams for this class
      const { data: teamsData, error: teamsError } = await supabase
        .from("teams")
        .select("*")
        .eq("class_id", classId);

      if (teamsError) {
        console.error("Error fetching teams:", teamsError);
      } else {
        setTeams(teamsData || []);
      }

    } catch (err: any) {
      console.error("Error fetching class data:", err);
      setError(err.message || "Failed to load class data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveDeadline = async () => {
    try {
      setIsSavingDeadline(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("You must be signed in to update deadline.");
      }

      const response = await fetch(`/api/educator/classes/${classId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          coursework_deadline: deadlineInput || null,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to update deadline");
      }

      await fetchClassData();
    } catch (err: any) {
      console.error("Error saving deadline:", err);
      setError(err.message || "Failed to update deadline");
    } finally {
      setIsSavingDeadline(false);
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

      const response = await fetch(`${API_BASE_URL}/educator/classes/${classId}/generate-teams`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
      });

      const payload = await response.json().catch(() => ({}));

      // Backend may return 200 with { error: "..." } for domain failures.
      if (payload?.error || payload?.detail) {
        throw new Error(payload.detail || payload.error);
      }

      if (!response.ok) {
        throw new Error(payload?.detail || payload?.error || "Failed to generate teams");
      }

      // Refresh data after team generation
      await fetchClassData();
    } catch (err: any) {
      console.error("Error generating teams:", err);
      setError(err.message || "Failed to generate teams");
    } finally {
      setIsGeneratingTeams(false);
    }
  };

  const handleResetTeams = async () => {
    try {
      setIsResettingTeams(true);
      setError(null);

      // Reset teams by setting team_id to null for all students in this class
      const { error: resetError } = await supabase
        .from("student_profiles")
        .update({ team_id: null })
        .in("id", enrolledStudents.map(s => s.id));

      if (resetError) {
        throw resetError;
      }

      // Delete teams for this class
      const { error: deleteError } = await supabase
        .from("teams")
        .delete()
        .eq("class_id", classId);

      if (deleteError) {
        throw deleteError;
      }

      // Refresh data after reset
      await fetchClassData();
    } catch (err: any) {
      console.error("Error resetting teams:", err);
      setError(err.message || "Failed to reset teams");
    } finally {
      setIsResettingTeams(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
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
          Loading class details...
        </div>
      </div>
    );
  }

  if (error || !classDetails) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm dark:border-red-800 dark:bg-red-950/30 sm:p-8">
        <h2 className="text-lg font-semibold text-red-900 dark:text-red-100">Error</h2>
        <p className="mt-2 text-sm text-red-700 dark:text-red-300">
          {error || "Class not found"}
        </p>
        <button
          onClick={() => router.push("/educator/classes")}
          className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
        >
          Back to Classes
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Class Header */}
      <div className="rounded-2xl border border-black/10 bg-surface p-6 shadow-sm dark:border-white/10">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{classDetails.name}</h1>
            <p className="mt-1 text-muted">{classDetails.description}</p>
            <div className="mt-4 flex items-center gap-6 text-sm text-muted">
              <span>Class Code: <code className="rounded bg-black/5 px-2 py-1 dark:bg-white/10">{classDetails.code}</code></span>
              <span>Max Team Size: {classDetails.max_team_size}</span>
              <span>Enrolled Students: {enrolledStudents.length}</span>
              <span>
                Deadline: {classDetails.coursework_deadline ? new Date(classDetails.coursework_deadline).toLocaleString() : "Not set"}
              </span>
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:max-w-md">
              <label htmlFor="coursework_deadline" className="text-sm font-medium text-foreground">
                Coursework deadline
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id="coursework_deadline"
                  type="datetime-local"
                  value={deadlineInput}
                  onChange={(e) => setDeadlineInput(e.target.value)}
                  className="w-full rounded-xl border border-black/10 bg-background px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/15"
                />
                <button
                  onClick={handleSaveDeadline}
                  disabled={isSavingDeadline}
                  className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingDeadline ? "Saving..." : "Save deadline"}
                </button>
              </div>
              <p className="text-xs text-muted">Students will see this as a countdown in their class tab.</p>
            </div>
          </div>
          <button
            onClick={() => router.push("/educator/classes")}
            className="rounded-xl border border-black/10 bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-black/[0.03] dark:border-white/15 dark:hover:bg-white/[0.06]"
          >
            Back to Classes
          </button>
        </div>
      </div>

      {/* Generate Teams Section */}
      <div className="rounded-2xl border border-black/10 bg-surface p-6 shadow-sm dark:border-white/10">
        <h2 className="text-lg font-semibold text-foreground mb-4">Team Generation</h2>
        <p className="text-sm text-muted mb-6">
          Generate AI-matched teams for this class based on student survey responses and your AI preferences.
        </p>

        {teams.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium">Teams have been generated ({teams.length} teams)</span>
            </div>
            <div className="flex gap-3 flex-col sm:flex-row">
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
            disabled={isGeneratingTeams || enrolledStudents.length < 2}
            className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isGeneratingTeams ? "Generating..." : "Generate AI Teams"}
          </button>
        )}

        {enrolledStudents.length < 2 && (
          <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
            Need at least 2 students enrolled to generate teams.
          </p>
        )}

        {error && (
          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </p>
        )}

        <div className="mt-8">
          <FeedbackAnalyticsPanel classId={classId} />
        </div>
      </div>

      {/* Class Survey Responses */}
      <div className="rounded-2xl border border-black/10 bg-surface p-6 shadow-sm dark:border-white/10">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Class survey responses</h2>
            <p className="mt-2 text-sm text-muted">
              Student profile survey answers for the current class only.
            </p>
          </div>
          <p className="text-sm text-muted">
            {completedResponses.length} of {surveyResponses.length} completed
          </p>
        </div>

        {completedResponses.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-black/15 bg-black/[0.02] p-6 text-center dark:border-white/20 dark:bg-white/[0.03]">
            <p className="text-sm text-muted">No completed surveys yet for this class.</p>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {teams.length > 0 ? (
              <>
                {groupedTeams.map((teamGroup) =>
                  teamGroup.responses.length > 0 ? (
                    <section key={teamGroup.id} className="rounded-2xl border border-black/6 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-950">
                      <div className="flex items-center justify-between gap-4 border-b border-black/10 bg-black/[0.04] px-4 py-3 dark:border-white/10 dark:bg-white/[0.06]">
                        <div>
                          <h3 className="text-sm font-semibold text-foreground">{teamGroup.name}</h3>
                          <p className="text-xs text-muted">Team members with completed surveys</p>
                        </div>
                        <p className="text-sm text-muted">{teamGroup.responses.length} completed</p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[40rem] border-collapse text-left">
                          <thead>
                            <tr>
                              <th className="border-b border-black/10 bg-black/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted dark:border-white/10 dark:bg-white/[0.06]">
                                Student
                              </th>
                              <th className="border-b border-black/10 bg-black/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted dark:border-white/10 dark:bg-white/[0.06]">
                                Submitted
                              </th>
                              <th className="border-b border-black/10 bg-black/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted dark:border-white/10 dark:bg-white/[0.06]">
                                Degree
                              </th>
                              <th className="border-b border-black/10 bg-black/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted dark:border-white/10 dark:bg-white/[0.06]">
                                Year
                              </th>
                              <th className="border-b border-black/10 bg-black/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted dark:border-white/10 dark:bg-white/[0.06]">
                                Ancillary module
                              </th>
                              <th className="border-b border-black/10 bg-black/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted dark:border-white/10 dark:bg-white/[0.06]">
                                Code confidence
                              </th>
                              <th className="border-b border-black/10 bg-black/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted dark:border-white/10 dark:bg-white/[0.06]">
                                Workload
                              </th>
                              <th className="border-b border-black/10 bg-black/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted dark:border-white/10 dark:bg-white/[0.06]">
                                Feedback readiness
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-black/6 dark:divide-white/10">
                            {teamGroup.responses.map((response) => (
                              <tr key={response.student_id} className="bg-background/50 transition-colors hover:bg-black/[0.03] dark:bg-transparent dark:hover:bg-white/[0.04]">
                                <td className="px-3 py-3 text-sm text-foreground">
                                  <div className="font-medium">{response.name}</div>
                                  <div className="text-xs text-muted">{response.email || "—"}</div>
                                </td>
                                <td className="px-3 py-3 text-sm text-muted">
                                  {response.profile_survey_completed_at ? new Date(response.profile_survey_completed_at).toLocaleDateString() : "—"}
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
                    </section>
                  ) : null
                )}
                {ungroupedResponses.length > 0 && (
                  <section className="rounded-2xl border border-black/6 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-950">
                    <div className="flex items-center justify-between gap-4 border-b border-black/10 bg-black/[0.04] px-4 py-3 dark:border-white/10 dark:bg-white/[0.06]">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">Ungrouped students</h3>
                        <p className="text-xs text-muted">Completed survey responses without a team assignment yet</p>
                      </div>
                      <p className="text-sm text-muted">{ungroupedResponses.length} completed</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[40rem] border-collapse text-left">
                        <thead>
                          <tr>
                            <th className="border-b border-black/10 bg-black/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted dark:border-white/10 dark:bg-white/[0.06]">
                              Student
                            </th>
                            <th className="border-b border-black/10 bg-black/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted dark:border-white/10 dark:bg-white/[0.06]">
                              Submitted
                            </th>
                            <th className="border-b border-black/10 bg-black/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted dark:border-white/10 dark:bg-white/[0.06]">
                              Degree
                            </th>
                            <th className="border-b border-black/10 bg-black/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted dark:border-white/10 dark:bg-white/[0.06]">
                              Year
                            </th>
                            <th className="border-b border-black/10 bg-black/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted dark:border-white/10 dark:bg-white/[0.06]">
                              Ancillary module
                            </th>
                            <th className="border-b border-black/10 bg-black/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted dark:border-white/10 dark:bg-white/[0.06]">
                              Code confidence
                            </th>
                            <th className="border-b border-black/10 bg-black/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted dark:border-white/10 dark:bg-white/[0.06]">
                              Workload
                            </th>
                            <th className="border-b border-black/10 bg-black/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted dark:border-white/10 dark:bg-white/[0.06]">
                              Feedback readiness
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black/6 dark:divide-white/10">
                          {ungroupedResponses.map((response) => (
                            <tr key={response.student_id} className="bg-background/50 transition-colors hover:bg-black/[0.03] dark:bg-transparent dark:hover:bg-white/[0.04]">
                              <td className="px-3 py-3 text-sm text-foreground">
                                <div className="font-medium">{response.name}</div>
                                <div className="text-xs text-muted">{response.email || "—"}</div>
                              </td>
                              <td className="px-3 py-3 text-sm text-muted">
                                {response.profile_survey_completed_at ? new Date(response.profile_survey_completed_at).toLocaleDateString() : "—"}
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
                  </section>
                )}
              </>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-black/6 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-950">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[40rem] border-collapse text-left">
                    <thead>
                      <tr>
                        <th className="border-b border-black/10 bg-black/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted dark:border-white/10 dark:bg-white/[0.06]">
                          Student
                        </th>
                        <th className="border-b border-black/10 bg-black/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted dark:border-white/10 dark:bg-white/[0.06]">
                          Submitted
                        </th>
                        <th className="border-b border-black/10 bg-black/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted dark:border-white/10 dark:bg-white/[0.06]">
                          Degree
                        </th>
                        <th className="border-b border-black/10 bg-black/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted dark:border-white/10 dark:bg-white/[0.06]">
                          Year
                        </th>
                        <th className="border-b border-black/10 bg-black/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted dark:border-white/10 dark:bg-white/[0.06]">
                          Ancillary module
                        </th>
                        <th className="border-b border-black/10 bg-black/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted dark:border-white/10 dark:bg-white/[0.06]">
                          Code confidence
                        </th>
                        <th className="border-b border-black/10 bg-black/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted dark:border-white/10 dark:bg-white/[0.06]">
                          Workload
                        </th>
                        <th className="border-b border-black/10 bg-black/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted dark:border-white/10 dark:bg-white/[0.06]">
                          Feedback readiness
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/6 dark:divide-white/10">
                      {completedResponses.map((response) => (
                        <tr key={response.student_id} className="bg-background/50 transition-colors hover:bg-black/[0.03] dark:bg-transparent dark:hover:bg-white/[0.04]">
                          <td className="px-3 py-3 text-sm text-foreground">
                            <div className="font-medium">{response.name}</div>
                            <div className="text-xs text-muted">{response.email || "—"}</div>
                          </td>
                          <td className="px-3 py-3 text-sm text-muted">
                            {response.profile_survey_completed_at ? new Date(response.profile_survey_completed_at).toLocaleDateString() : "—"}
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
              </div>
            )}
          </div>
        )}
      </div>

      {/* Enrolled Students */}
      <div className="rounded-2xl border border-black/10 bg-surface p-6 shadow-sm dark:border-white/10">
        <h2 className="text-lg font-semibold text-foreground mb-4">Enrolled Students ({enrolledStudents.length})</h2>

        {enrolledStudents.length === 0 ? (
          <p className="text-muted">No students enrolled yet. Share the class code <code className="rounded bg-black/5 px-1 py-0.5 dark:bg-white/10">{classDetails.code}</code> with students.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {enrolledStudents.map((student) => (
              <div
                key={student.id}
                className="rounded-lg border border-black/5 bg-white p-4 dark:border-white/10 dark:bg-zinc-900"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10">
                    <svg
                      className="h-5 w-5 text-brand"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="1.5"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground">
                      {student.survey_name || "Unnamed Student"}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-muted">
                        Enrolled {new Date(student.enrolled_at).toLocaleDateString()}
                      </p>
                      {student.survey_completed ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
                          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Survey Complete
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          Survey Pending
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Teams Section */}
      {teams.length > 0 && (
        <div className="rounded-2xl border border-black/10 bg-surface p-6 shadow-sm dark:border-white/10">
          <h2 className="text-lg font-semibold text-foreground mb-4">Generated Teams</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {teams.map((team) => (
              <div
                key={team.id}
                className="rounded-lg border border-black/5 bg-white p-4 dark:border-white/10 dark:bg-zinc-900"
              >
                <h3 className="font-semibold text-foreground mb-2">{team.name}</h3>
                <p className="text-sm text-muted mb-3">{team.reason}</p>
                <p className="text-xs text-muted">
                  Created {new Date(team.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}