"use client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createStudentBrowserClient } from "@/lib/supabase/student-browser-client";
import {
  AssignmentCard,
  type Assignment,
  type SurveyResponse,
} from "@/app/educator/(workspace)/classes/assignment-card";
import { CreateAssignmentModal } from "@/app/educator/(workspace)/classes/create-assignment-modal";
import { ClassFeedbackOverview } from "@/app/educator/(workspace)/classes/class-feedback-overview";
import { DraftTeamsBoard, DraftTeam } from "./draft-teams-board";

interface ClassDetails {
  id: string;
  name: string;
  description: string;
  code: string;
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

interface TeamMember {
  student_id: string;
  team_id: string;
  assignment_id: string;
}

export default function ClassManagementPage() {
  const params = useParams();
  const router = useRouter();
  const classId = params.classId as string;

  const [classDetails, setClassDetails] = useState<ClassDetails | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [enrolledStudents, setEnrolledStudents] = useState<EnrolledStudent[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [drafts, setDrafts] = useState<DraftTeam[]>([]);
  const [surveyResponses, setSurveyResponses] = useState<SurveyResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateAssignmentModal, setShowCreateAssignmentModal] = useState(false);

  const supabase = createStudentBrowserClient();

  useEffect(() => {
    if (classId) {
      fetchClassData();
    }
  }, [classId]);

  const fetchClassData = async (options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) {
        setIsLoading(true);
      }
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login/educator");
        return;
      }

      const authHeaders = {
        Authorization: `Bearer ${session.access_token}`,
      };

      const [classesResponse, assignmentsResponse] = await Promise.all([
        fetch("/api/educator/classes", { headers: authHeaders }),
        fetch(`/api/educator/classes/${classId}/assignments`, { headers: authHeaders }),
      ]);

      if (!classesResponse.ok) {
        throw new Error("Failed to fetch classes");
      }

      const classesData = await classesResponse.json();
      const classInfo = classesData.classes.find((c: ClassDetails) => c.id === classId);

      if (!classInfo) {
        throw new Error("Class not found");
      }

      setClassDetails(classInfo);

      let fetchedAssignments: Assignment[] = [];
      if (assignmentsResponse.ok) {
        const assignmentsData = await assignmentsResponse.json();
        fetchedAssignments = assignmentsData.assignments || [];
        setAssignments(fetchedAssignments);
      } else {
        setAssignments([]);
      }

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
          survey_confidence_presentation_public_speaking:
            enrollment.student_profiles.survey_confidence_presentation_public_speaking,
          survey_confidence_mathematical_literacy:
            enrollment.student_profiles.survey_confidence_mathematical_literacy,
          survey_confidence_abstract_complex_content:
            enrollment.student_profiles.survey_confidence_abstract_complex_content,
          survey_confidence_conflict_resolution:
            enrollment.student_profiles.survey_confidence_conflict_resolution,
          survey_approach_deadline: enrollment.student_profiles.survey_approach_deadline,
          survey_approach_discussion: enrollment.student_profiles.survey_approach_discussion,
          survey_approach_disagreement: enrollment.student_profiles.survey_approach_disagreement,
          survey_approach_new_concepts: enrollment.student_profiles.survey_approach_new_concepts,
          survey_approach_communication: enrollment.student_profiles.survey_approach_communication,
          survey_approach_teammate_work: enrollment.student_profiles.survey_approach_teammate_work,
          survey_approach_heavy_workload: enrollment.student_profiles.survey_approach_heavy_workload,
          survey_approach_group_project_role:
            enrollment.student_profiles.survey_approach_group_project_role,
          survey_approach_critical_feedback:
            enrollment.student_profiles.survey_approach_critical_feedback,
        }));

        setEnrolledStudents(students);
        setSurveyResponses(responses);
      }

      const { data: teamsData, error: teamsError } = await supabase
        .from("teams")
        .select("*")
        .eq("class_id", classId);

      if (teamsError) {
        console.error("Error fetching teams:", teamsError);
      } else {
        setTeams(teamsData || []);
      }

      const assignmentIds = fetchedAssignments.map((a) => a.id);

      if (assignmentIds.length > 0) {
        const { data: membersData, error: membersError } = await supabase
          .from("team_members")
          .select("student_id, team_id, assignment_id")
          .in("assignment_id", assignmentIds);

        if (membersError) {
          console.error("Error fetching team members:", membersError);
        } else {
          setTeamMembers(membersData || []);
        }
      } else {
        setTeamMembers([]);
      }
      // Fetch draft teams for this class (best-effort: don't block page if backend is down)
      try {
        const draftController = new AbortController();
        const draftTimeout = setTimeout(() => draftController.abort(), 5000);
        const draftsResponse = await fetch(`${API_BASE_URL}/educator/classes/${classId}/draft-teams`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          signal: draftController.signal,
        });
        clearTimeout(draftTimeout);
        if (draftsResponse.ok) {
          const draftsData = await draftsResponse.json();
          setDrafts(draftsData.drafts || []);
        }
      } catch (draftErr: any) {
        // Backend may not be running — silently ignore, drafts just won't show
        if (draftErr.name !== "AbortError") {
          console.warn("Could not fetch draft teams (is the backend running?):", draftErr.message);
        }
      }

    } catch (err: any) {
      console.error("Error fetching class data:", err);
      setError(err.message || "Failed to load class data");
    } finally {
      if (!options?.silent) {
        setIsLoading(false);
      }
    }
  };

  const completedResponses = surveyResponses.filter((r) => r.survey_completed);

  const getTeamMemberMap = (assignmentId: string) => {
    const map = new Map<string, string>();
    teamMembers
      .filter((member) => member.assignment_id === assignmentId)
      .forEach((member) => map.set(member.student_id, member.team_id));
    return map;
  };

  const applyAssignmentTeams = (
    assignmentId: string,
    newTeams: Team[],
    newMembers: TeamMember[],
  ) => {
    setTeams((prev) => [
      ...prev.filter((team) => team.assignment_id !== assignmentId),
      ...newTeams,
    ]);
    setTeamMembers((prev) => [
      ...prev.filter((member) => member.assignment_id !== assignmentId),
      ...newMembers,
    ]);
  };

  const getApiErrorMessage = (payload: unknown) => {
    if (!payload || typeof payload !== "object") {
      return null;
    }

    const record = payload as { detail?: unknown; error?: unknown };
    if (typeof record.detail === "string") {
      return record.detail;
    }

    if (record.detail && typeof record.detail === "object") {
      const detail = record.detail as { error?: unknown; redirect_endpoint?: unknown };
      if (typeof detail.error === "string") {
        return detail.error;
      }
      if (detail.redirect_endpoint) {
        return JSON.stringify(detail);
      }
    }

    return typeof record.error === "string" ? record.error : null;
  };

  const handleSwapDraft = async (studentId: string, fromDraftId: string, toDraftId: string, reason: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const response = await fetch(`${API_BASE_URL}/educator/classes/${classId}/draft-teams/swap`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        student_id: studentId,
        from_draft_team_id: fromDraftId,
        to_draft_team_id: toDraftId,
        reason: reason,
      }),
    });
    if (!response.ok) throw new Error("Swap failed");
    await fetchClassData();
  };

  const handlePublishTeams = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(`${API_BASE_URL}/educator/classes/${classId}/publish-teams`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const payload = await response.json().catch(() => ({}));
      const apiError = getApiErrorMessage(payload);
      if (apiError) throw new Error(apiError);
      if (!response.ok) throw new Error(apiError || "Publish failed");

      await fetchClassData();
    } catch (err: any) {
      console.error("Error publishing teams:", err);
      setError(err.message || "Failed to publish teams");
      throw err;
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
      <div className="rounded-2xl border border-black/10 bg-surface p-6 shadow-sm dark:border-white/10">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{classDetails.name}</h1>
            <p className="mt-1 text-muted">{classDetails.description}</p>
            <div className="mt-4 flex flex-wrap items-center gap-6 text-sm text-muted">
              <span>
                Class Code:{" "}
                <code className="rounded bg-black/5 px-2 py-1 dark:bg-white/10">{classDetails.code}</code>
              </span>
              <span>Enrolled Students: {enrolledStudents.length}</span>
              <span>Assignments: {assignments.length}</span>
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

      <div>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Assignments</h2>
            <p className="text-sm text-muted">
              Each assignment has its own deadline, team settings, and team generation.
            </p>
          </div>
          <button
            onClick={() => setShowCreateAssignmentModal(true)}
            className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-deep"
          >
            Add Assignment
          </button>
        </div>

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
          <ClassFeedbackOverview classId={classId} />
        </div>
      </div>

      {/* Draft Teams Section */}
      {drafts.length > 0 && (
        <div className="rounded-2xl border border-black/10 bg-surface p-6 shadow-sm dark:border-white/10 mt-8">
          <DraftTeamsBoard
            classId={classId}
            drafts={drafts}
            studentsMap={
              Object.fromEntries(surveyResponses.map(r => [
                r.student_id,
                { id: r.student_id, name: r.name, email: r.email, workload: r.survey_approach_heavy_workload, coding: r.survey_confidence_coding }
              ]))
            }
            onSwap={handleSwapDraft}
            onPublish={handlePublishTeams}
          />
        </div>
      )}

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

        {assignments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/15 bg-black/[0.02] p-8 text-center dark:border-white/20 dark:bg-white/[0.03]">
            <p className="text-sm text-muted">No assignments yet. Add one to set deadlines and generate teams.</p>
            <button
              onClick={() => setShowCreateAssignmentModal(true)}
              className="mt-4 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-deep"
            >
              Add Assignment
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {assignments.map((assignment) => (
              <AssignmentCard
                key={assignment.id}
                assignment={assignment}
                classId={classId}
                teams={teams}
                teamMemberMap={getTeamMemberMap(assignment.id)}
                surveyResponses={surveyResponses}
                enrolledStudentCount={enrolledStudents.length}
                onRefresh={fetchClassData}
                onTeamsUpdated={applyAssignmentTeams}
              />
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-black/10 bg-surface p-6 shadow-sm dark:border-white/10">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Enrolled Students ({enrolledStudents.length})
        </h2>

        {enrolledStudents.length === 0 ? (
          <p className="text-muted">
            No students enrolled yet. Share the class code{" "}
            <code className="rounded bg-black/5 px-1 py-0.5 dark:bg-white/10">{classDetails.code}</code> with
            students.
          </p>
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
                    <div className="mt-1 flex items-center gap-2">
                      <p className="text-xs text-muted">
                        Enrolled {new Date(student.enrolled_at).toLocaleDateString()}
                      </p>
                      {student.survey_completed ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
                          Survey Complete
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
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

      {showCreateAssignmentModal && (
        <CreateAssignmentModal
          classId={classId}
          onClose={() => setShowCreateAssignmentModal(false)}
          onAssignmentCreated={() => {
            setShowCreateAssignmentModal(false);
            fetchClassData();
          }}
        />
      )}
    </div>
  )
}
