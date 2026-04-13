import type { SupabaseClient } from "@supabase/supabase-js";

/** Row shape returned by `list_completed_student_surveys_for_educator`. */
export type CompletedStudentSurveyRow = {
  student_id: string;
  email: string;
  survey_name: string | null;
  survey_degree_title: string | null;
  survey_year: number | null;
  survey_alevel_or_equivalent_titles: unknown;
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
  profile_survey_completed_at: string | null;
};

export async function fetchCompletedStudentSurveysForEducator(supabase: SupabaseClient) {
  return supabase.rpc("list_completed_student_surveys_for_educator");
}

export function formatAlevelTitlesJson(value: unknown): string {
  if (value == null) return "—";
  if (!Array.isArray(value)) return "—";
  const strings = value.filter((x): x is string => typeof x === "string" && x.trim() !== "");
  return strings.length > 0 ? strings.join(", ") : "—";
}
