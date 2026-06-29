export const MATCHING_SKILL_OPTIONS = [
  { key: "coding", label: "Coding" },
  { key: "written_reports", label: "Written reports" },
  { key: "presentation_public_speaking", label: "Presentation / public speaking" },
  { key: "mathematical_literacy", label: "Mathematical literacy" },
  {
    key: "understanding_abstract_complex_content",
    label: "Understanding abstract / complex content",
  },
  { key: "conflict_resolution", label: "Conflict resolution" },
] as const;

export type MatchingSkillKey = (typeof MATCHING_SKILL_OPTIONS)[number]["key"];

export const ALL_MATCHING_SKILL_KEYS: MatchingSkillKey[] = MATCHING_SKILL_OPTIONS.map(
  (option) => option.key,
);

const MATCHING_SKILL_KEY_SET = new Set<string>(ALL_MATCHING_SKILL_KEYS);

export type AiPreferences = {
  wanted_skills: MatchingSkillKey[];
  focus_skills: boolean;
  focus_working_style: boolean;
  focus_availability: boolean;
  balance_diversity: boolean;
};

export const DEFAULT_AI_PREFERENCES: AiPreferences = {
  wanted_skills: [],
  focus_skills: false,
  focus_working_style: true,
  focus_availability: true,
  balance_diversity: true,
};

function parseWantedSkills(raw: unknown): MatchingSkillKey[] | null {
  if (!Array.isArray(raw)) {
    return null;
  }

  const seen = new Set<MatchingSkillKey>();
  for (const item of raw) {
    if (typeof item !== "string" || !MATCHING_SKILL_KEY_SET.has(item)) {
      continue;
    }
    seen.add(item as MatchingSkillKey);
  }

  return ALL_MATCHING_SKILL_KEYS.filter((key) => seen.has(key));
}

function readBoolean(raw: unknown, fallback: boolean): boolean {
  return typeof raw === "boolean" ? raw : fallback;
}

export function normalizeAiPreferences(raw: unknown): AiPreferences {
  const source =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const parsedWantedSkills = parseWantedSkills(source.wanted_skills);
  const legacyFocusSkills = readBoolean(source.focus_skills, DEFAULT_AI_PREFERENCES.focus_skills);

  const wanted_skills =
    parsedWantedSkills ??
    (legacyFocusSkills ? [...ALL_MATCHING_SKILL_KEYS] : []);

  return {
    wanted_skills,
    focus_skills: wanted_skills.length > 0,
    focus_working_style: readBoolean(
      source.focus_working_style,
      DEFAULT_AI_PREFERENCES.focus_working_style,
    ),
    focus_availability: readBoolean(
      source.focus_availability,
      DEFAULT_AI_PREFERENCES.focus_availability,
    ),
    balance_diversity: readBoolean(
      source.balance_diversity,
      DEFAULT_AI_PREFERENCES.balance_diversity,
    ),
  };
}

export function getMatchingSkillLabel(key: MatchingSkillKey): string {
  return MATCHING_SKILL_OPTIONS.find((option) => option.key === key)?.label ?? key;
}

export const MATCHING_FOCUS_OPTIONS = [
  {
    key: "focus_working_style",
    label: "Working style compatibility",
    description: "Consider communication and deadline preferences",
  },
  {
    key: "focus_availability",
    label: "Schedule compatibility",
    description: "Match students with similar availability",
  },
  {
    key: "balance_diversity",
    label: "Balance team diversity",
    description: "Create diverse teams with varied backgrounds",
  },
] as const;

export type MatchingFocusKey = (typeof MATCHING_FOCUS_OPTIONS)[number]["key"];

export const ALL_MATCHING_FOCUS_KEYS: MatchingFocusKey[] = MATCHING_FOCUS_OPTIONS.map(
  (option) => option.key,
);

export function getSelectedMatchingFocusKeys(
  preferences: Pick<AiPreferences, MatchingFocusKey>,
): MatchingFocusKey[] {
  return ALL_MATCHING_FOCUS_KEYS.filter((key) => preferences[key]);
}

export function applyMatchingFocusKeys(
  preferences: AiPreferences,
  selected: MatchingFocusKey[],
): AiPreferences {
  const selectedSet = new Set(selected);

  return {
    ...preferences,
    focus_working_style: selectedSet.has("focus_working_style"),
    focus_availability: selectedSet.has("focus_availability"),
    balance_diversity: selectedSet.has("balance_diversity"),
  };
}
