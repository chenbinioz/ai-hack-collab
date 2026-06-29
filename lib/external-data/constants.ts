/**
 * External learning analytics CSV file types and expected column headers.
 * Headers only — no sample row data.
 */

export const EXTERNAL_DATA_FILE_TYPES = [
  "person_dim",
  "calendar_dim",
  "module_instance_dim",
  "lms_item_dim",
  "video_dim",
  "person_module_instance_fact",
  "person_module_instance_outcome_fact",
  "lms_item_activity_by_session_fact",
  "video_activity_by_view_fact",
] as const;

export type ExternalDataFileType = (typeof EXTERNAL_DATA_FILE_TYPES)[number];

export const REQUIRED_EXTERNAL_DATA_FILE_TYPE: ExternalDataFileType = "person_dim";

export const EXTERNAL_DATA_FILE_LABELS: Record<ExternalDataFileType, string> = {
  person_dim: "Person dimension (required)",
  calendar_dim: "Calendar dimension",
  module_instance_dim: "Module instance dimension",
  lms_item_dim: "LMS item dimension",
  video_dim: "Video dimension",
  person_module_instance_fact: "Person–module registration",
  person_module_instance_outcome_fact: "Module outcomes / marks",
  lms_item_activity_by_session_fact: "LMS activity by session",
  video_activity_by_view_fact: "Video activity by view",
};

export const EXTERNAL_DATA_EXPECTED_FILENAMES: Record<ExternalDataFileType, string> = {
  person_dim: "la_dataset_person_dim.csv",
  calendar_dim: "la_dataset_calendar_dim.csv",
  module_instance_dim: "la_dataset_module_instance_dim.csv",
  lms_item_dim: "la_dataset_lms_item_dim.csv",
  video_dim: "la_dataset_video_dim.csv",
  person_module_instance_fact: "la_dataset_person_module_instance_fact.csv",
  person_module_instance_outcome_fact: "la_dataset_person_module_instance_outcome_fact.csv",
  lms_item_activity_by_session_fact: "la_dataset_lms_item_activity_by_session_fact.csv",
  video_activity_by_view_fact: "la_dataset_video_activity_by_view_fact.csv",
};

/** Expected CSV header columns per file type (order matters for validation). */
export const EXTERNAL_DATA_HEADERS: Record<ExternalDataFileType, readonly string[]> = {
  person_dim: ["P_ID"],
  calendar_dim: ["DATE", "YEAR", "MONTH", "DAY", "WEEK_NUMBER", "ACADEMIC_YEAR", "TERM", "TERM_CODE"],
  module_instance_dim: [
    "MODULE_INSTANCE_ID",
    "MODULE_LEVEL",
    "ACADEMIC_YEAR_START",
    "TERM",
    "DEPARTMENT_ID",
  ],
  lms_item_dim: ["LMS_ITEM_ID", "MODULE_INSTANCE_ID", "TYPE_LABEL", "GROUP_LABEL"],
  video_dim: ["VIDEO_ID", "MODULE_INSTANCE_ID", "VIDEO_LENGTH_MINUTES"],
  person_module_instance_fact: ["PMI_ID", "P_ID", "MODULE_INSTANCE_ID", "MODULE_REGISTRATION_STATUS"],
  person_module_instance_outcome_fact: [
    "OUTCOME_ID",
    "P_ID",
    "MODULE_INSTANCE_ID",
    "MARK",
    "GRADE_MODE",
  ],
  lms_item_activity_by_session_fact: [
    "PIT_ID",
    "DATE",
    "P_ID",
    "LMS_ITEM_ID",
    "TIMESTAMP",
    "LOGIN_ID",
    "INTERACTION_COUNT",
    "TOTAL_SECONDS_BEFORE_NEXT_INTERACTION",
  ],
  video_activity_by_view_fact: [
    "PVT_ID",
    "P_ID",
    "VIDEO_ID",
    "DATE",
    "TIMESTAMP",
    "TOTAL_MINUTES_DELIVERED",
    "VIEWING_TYPE",
  ],
};

export function validateCsvHeaders(
  fileType: ExternalDataFileType,
  headerLine: string,
): { ok: true } | { ok: false; message: string } {
  const expected = EXTERNAL_DATA_HEADERS[fileType];
  const actual = headerLine
    .trim()
    .replace(/^\uFEFF/, "")
    .split(",")
    .map((h) => h.trim());

  if (actual.length < expected.length) {
    return {
      ok: false,
      message: `Expected at least ${expected.length} columns (${expected.join(", ")}).`,
    };
  }

  for (let i = 0; i < expected.length; i++) {
    if (actual[i]?.toUpperCase() !== expected[i]) {
      return {
        ok: false,
        message: `Column ${i + 1} should be ${expected[i]}, got ${actual[i] ?? "(missing)"}.`,
      };
    }
  }

  return { ok: true };
}

export function normalizeExternalStudentId(digits: string): string {
  const trimmed = digits.trim();
  if (!/^[0-9]{8}$/.test(trimmed)) {
    throw new Error("Student ID must be exactly 8 digits.");
  }
  return `P${trimmed}`;
}
