"use client";

import { useEffect, useState } from "react";
import { useStudentAuth } from "@/app/providers";
import { createStudentBrowserClient } from "@/lib/supabase/student-browser-client";

interface StudentProfile {
  survey_confidence_coding: number;
  survey_confidence_written_reports: number;
  survey_confidence_presentation_public_speaking: number;
  survey_confidence_mathematical_literacy: number;
  survey_confidence_abstract_complex_content: number;
  survey_confidence_conflict_resolution: number;
  survey_name: string;
}

const SKILL_LABELS = {
  survey_confidence_coding: "Coding",
  survey_confidence_written_reports: "Written Reports",
  survey_confidence_presentation_public_speaking: "Presentation / Public Speaking",
  survey_confidence_mathematical_literacy: "Mathematical Literacy",
  survey_confidence_abstract_complex_content: "Understanding Abstract/Complex Content",
  survey_confidence_conflict_resolution: "Conflict Resolution",
} as const;

export function StudentSkillsVisualization() {
  const { user, isStudentAuthLoading } = useStudentAuth();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createStudentBrowserClient();

    async function fetchStudentProfile() {
      if (isStudentAuthLoading) {
        return;
      }

      if (!user?.id) {
        setError("Not authenticated");
        setIsLoading(false);
        return;
      }

      try {
        const { data: rpcData, error } = await supabase.rpc("get_student_profile_survey", {});
        const profileData = Array.isArray(rpcData) ? rpcData[0] : rpcData;

        if (cancelled) return;

        if (error) {
          setError(error.message || "Failed to load profile data");
          return;
        }

        if (!profileData) {
          setError("Complete your profile survey to see your skills visualization.");
          return;
        }

        setProfile(profileData as StudentProfile);
      } catch (err) {
        setError("Failed to load skills data");
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchStudentProfile();

    return () => {
      cancelled = true;
    };
  }, [user, isStudentAuthLoading]);

  const getSkillLevel = (confidence: number) => {
    if (confidence >= 4) return { level: "Expert", color: "bg-green-500", textColor: "text-green-700" };
    if (confidence >= 3) return { level: "Advanced", color: "bg-blue-500", textColor: "text-blue-700" };
    if (confidence >= 2) return { level: "Intermediate", color: "bg-yellow-500", textColor: "text-yellow-700" };
    return { level: "Beginner", color: "bg-red-500", textColor: "text-red-700" };
  };

  const getStars = (confidence: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span
        key={i}
        className={`text-2xl ${i < confidence ? "text-yellow-400" : "text-gray-300"}`}
      >
        ★
      </span>
    ));
  };

  if (isLoading) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center px-4 py-8">
        <p className="text-sm text-muted">Loading your skills…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center px-4 py-8">
        <div className="text-center">
          <p className="text-sm text-red-600 mb-2">{error}</p>
          <p className="text-xs text-muted">Make sure you've completed your profile survey.</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center px-4 py-8">
        <div className="text-center">
          <p className="text-sm text-muted mb-2">No profile data found.</p>
          <p className="text-xs text-muted">Complete your profile survey to see your skills visualization.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-foreground">Your Skills</h2>
        <p className="mt-2 text-muted">Your confidence levels across core skills</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Object.entries(SKILL_LABELS).map(([key, label]) => {
          const confidence = profile[key as keyof StudentProfile] as number;
          const { level, color, textColor } = getSkillLevel(confidence);

          return (
            <div
              key={key}
              className="rounded-2xl border border-black/10 bg-surface p-6 shadow-sm dark:border-white/10"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground text-sm">{label}</h3>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${color} text-white`}>
                  {level}
                </span>
              </div>

              <div className="flex items-center justify-center mb-3">
                <div className="flex space-x-1">
                  {getStars(confidence)}
                </div>
              </div>

              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{confidence}/5</p>
                <p className={`text-xs font-medium ${textColor}`}>{level} Level</p>
              </div>

              {/* Progress bar */}
              <div className="mt-4">
                <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                  <div
                    className={`h-2 rounded-full ${color}`}
                    style={{ width: `${(confidence / 5) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Skills Summary */}
      <div className="rounded-2xl border border-black/10 bg-surface p-6 shadow-sm dark:border-white/10">
        <h2 className="text-lg font-semibold text-foreground mb-4">Skills Summary</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="font-medium text-foreground mb-2">Strongest Areas</h3>
            <ul className="space-y-1 text-sm text-muted">
              {Object.entries(SKILL_LABELS)
                .filter(([key]) => (profile[key as keyof StudentProfile] as number) >= 4)
                .map(([key, label]) => (
                  <li key={key} className="flex items-center">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                    {label}
                  </li>
                ))}
            </ul>
          </div>
          <div>
            <h3 className="font-medium text-foreground mb-2">Areas for Growth</h3>
            <ul className="space-y-1 text-sm text-muted">
              {Object.entries(SKILL_LABELS)
                .filter(([key]) => (profile[key as keyof StudentProfile] as number) <= 2)
                .map(([key, label]) => (
                  <li key={key} className="flex items-center">
                    <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                    {label}
                  </li>
                ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}