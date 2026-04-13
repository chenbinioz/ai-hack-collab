/** Single option for now; expand when more degrees are supported. */
export const SURVEY_DEGREE_OPTIONS = ["Chemistry"] as const;

export const SURVEY_YEAR_OPTIONS = [1, 2, 3, 4] as const;

/**
 * A-Level or equivalent — multi-select. Extend this list as needed.
 */
export const SURVEY_ALEVEL_OR_EQUIVALENT_OPTIONS = [
  "Biology",
  "Chemistry",
  "Mathematics",
  "Physics",
  "Further Mathematics",
  "Computer Science",
  "Psychology",
  "Geography",
  "History",
  "English Literature",
  "Economics",
  "Other / equivalent qualification",
] as const;

export const SURVEY_ANCILLARY_MODULE_OPTIONS = [
  "Maths and Physics",
  "Med Chem",
  "Language",
] as const;

export type SurveyAlevelOrEquivalentTitle = (typeof SURVEY_ALEVEL_OR_EQUIVALENT_OPTIONS)[number];
