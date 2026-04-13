"use client";

import { useCallback, useEffect, useState } from "react";
import { useStudentAuth } from "@/app/providers";
import { createStudentBrowserClient } from "@/lib/supabase/student-browser-client";
import { hasStudentSupabaseEnv } from "@/lib/supabase/student-env";

export type StudentProfileSurveyStatus = {
  isLoading: boolean;
  surveyCompleted: boolean;
  refetch: () => void;
};

/**
 * Loads whether the signed-in student has submitted the one-time profile survey.
 * Uses RPC `student_profile_survey_completed` so reads do not hit recursive RLS on `student_profiles`.
 */
export function useStudentProfileSurveyStatus(): StudentProfileSurveyStatus {
  const { user, isStudentAuthLoading } = useStudentAuth();
  const [isRowLoading, setIsRowLoading] = useState(true);
  const [surveyCompleted, setSurveyCompleted] = useState(false);
  const [fetchToken, setFetchToken] = useState(0);

  const refetch = useCallback(() => {
    setFetchToken((t) => t + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (isStudentAuthLoading || !user || !hasStudentSupabaseEnv()) {
      queueMicrotask(() => {
        if (cancelled) return;
        setSurveyCompleted(false);
        setIsRowLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }

    queueMicrotask(() => {
      if (cancelled) return;
      setIsRowLoading(true);
    });

    void (async () => {
      const supabase = createStudentBrowserClient();
      const { data, error } = await supabase.rpc("student_profile_survey_completed");

      if (cancelled) return;

      queueMicrotask(() => {
        if (cancelled) return;
        if (error) {
          setSurveyCompleted(false);
          setIsRowLoading(false);
          return;
        }
        setSurveyCompleted(data === true);
        setIsRowLoading(false);
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [user, isStudentAuthLoading, fetchToken]);

  return {
    isLoading: isStudentAuthLoading || isRowLoading,
    surveyCompleted,
    refetch,
  };
}
