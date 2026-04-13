/**
 * Database column names for the student profile survey (`student_profiles`), in question order.
 * Must stay aligned with `supabase/migrations/004_student_profile_survey.sql`.
 */
export const STUDENT_PROFILE_SURVEY_COLUMNS_ORDERED = [
  // Page 1 — Information
  "survey_name",
  "survey_degree_title",
  "survey_year",
  "survey_alevel_or_equivalent_titles",
  "survey_ancillary_module",
  // Page 2 — Relevant skills (confidence 1–5)
  "survey_confidence_coding",
  "survey_confidence_written_reports",
  "survey_confidence_presentation_public_speaking",
  "survey_confidence_mathematical_literacy",
  "survey_confidence_abstract_complex_content",
  "survey_confidence_conflict_resolution",
  // Page 3 — Approach to work (1–5 scales)
  "survey_approach_deadline",
  "survey_approach_discussion",
  "survey_approach_disagreement",
  "survey_approach_new_concepts",
  "survey_approach_communication",
  "survey_approach_teammate_work",
  "survey_approach_heavy_workload",
  "survey_approach_group_project_role",
  "survey_approach_critical_feedback",
  // Submission lock (not a “question”, but part of the survey payload)
  "profile_survey_completed_at",
] as const;
