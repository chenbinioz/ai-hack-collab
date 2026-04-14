"use client";

import { useState, useEffect } from "react";
import { createStudentBrowserClient } from "@/lib/supabase/student-browser-client";
import { TeamMessaging } from "./team-messaging";

interface Team {
  id: string;
  name: string;
  reason: string;
}

interface Teammate {
  id: string;
  survey_name: string | null;
}

export function TeamHub() {
  const [team, setTeam] = useState<Team | null>(null);
  const [teammates, setTeammates] = useState<Teammate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [hasSubmittedFeedback, setHasSubmittedFeedback] = useState(false);

  const supabase = createStudentBrowserClient();

  useEffect(() => {
    fetchTeamData();
  }, []);

  const fetchTeamData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("Not authenticated");
      }

      // Fetch user's profile using student RPC function
      const { data: profileData, error: profileError } = await supabase
        .rpc('get_student_own_profile');

      if (profileError) {
        throw profileError;
      }

      if (!profileData || profileData.length === 0) {
        throw new Error("Profile not found or survey not completed");
      }

      const currentUserProfile = profileData[0];

      if (!currentUserProfile.team_id) {
        // No team assigned yet
        setTeam(null);
        setTeammates([]);
        return;
      }

      // Check if user has already submitted feedback for this team
      const { data: existingFeedback } = await supabase
        .from("feedback")
        .select("id")
        .eq("student_id", user.id)
        .eq("team_id", currentUserProfile.team_id)
        .limit(1);

      setHasSubmittedFeedback(!!(existingFeedback && existingFeedback.length > 0));

      // Fetch team details and teammates from our API
      const response = await fetch("http://localhost:8000/educator-data");
      if (!response.ok) {
        throw new Error("Failed to fetch team data");
      }

      const data = await response.json();
      const teamData = data.teams.find((t: Team) => t.id === currentUserProfile.team_id);
      const allStudents = data.students || [];

      if (!teamData) {
        throw new Error("Team not found");
      }

      // Filter teammates to only those in the same team, excluding current user
      const teamTeammates = allStudents.filter((student: any) =>
        student.team_id === currentUserProfile.team_id && student.id !== user.id
      );

      setTeam(teamData);
      setTeammates(teamTeammates);

      // Show feedback modal if team is newly assigned and no feedback submitted yet
      if (!hasSubmittedFeedback && !existingFeedback?.length) {
        setShowFeedbackModal(true);
      }

    } catch (err: any) {
      console.error('Error fetching team data:', err);
      setError(err.message || 'Failed to load team information');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <section className="mt-10 rounded-2xl border border-black/10 bg-surface p-6 shadow-sm dark:border-white/10 sm:p-8">
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
      <section className="mt-10 rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm dark:border-red-800 dark:bg-red-950/30 sm:p-8">
        <h2 className="text-lg font-semibold text-red-900 dark:text-red-100">Team Hub</h2>
        <p className="mt-2 text-sm text-red-700 dark:text-red-300">
          Error loading team information: {error}
        </p>
      </section>
    );
  }

  return (
    <section className="mt-10 rounded-2xl border border-black/10 bg-surface p-6 shadow-sm dark:border-white/10 sm:p-8">
      <h2 className="text-lg font-semibold text-foreground">Team Hub</h2>

      {!team ? (
        <div className="mt-4 rounded-lg border border-dashed border-black/15 bg-black/[0.02] p-6 text-center dark:border-white/20 dark:bg-white/[0.03]">
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
                d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
              />
            </svg>
          </div>
          <h3 className="mt-4 text-sm font-medium text-foreground">Your team is being formed by AI...</h3>
          <p className="mt-2 text-sm text-muted">
            The AI is analyzing student profiles and forming optimal teams. Check back soon!
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-6">
          {/* Team Info */}
          <div className="rounded-lg border border-black/5 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
            <h3 className="text-lg font-semibold text-foreground">{team.name}</h3>
            <p className="mt-2 text-sm text-muted">{team.reason}</p>
          </div>

          {/* Teammates */}
          <div>
            <h4 className="text-sm font-medium text-foreground mb-3">
              Your Teammates ({teammates.length})
            </h4>
            {teammates.length === 0 ? (
              <p className="text-sm text-muted">No other teammates assigned yet.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {teammates.map((teammate) => (
                  <div
                    key={teammate.id}
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
                        <h5 className="font-medium text-foreground">
                          {teammate.survey_name || "Unnamed Student"}
                        </h5>
                        <p className="text-xs text-muted">Team member</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Team Messaging - only show when team is assigned */}
      {team && (
        <TeamMessaging teamId={team.id} teamName={team.name} />
      )}
    </section>
  );
}