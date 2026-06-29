"use client";

import { ChipPreferencesPicker } from "@/components/chip-preferences-picker";
import {
  ALL_MATCHING_SKILL_KEYS,
  MATCHING_SKILL_OPTIONS,
  type MatchingSkillKey,
} from "@/lib/matching/skill-preferences";

interface SkillPreferencesPickerProps {
  selected: MatchingSkillKey[];
  onChange: (skills: MatchingSkillKey[]) => void;
}

export function SkillPreferencesPicker({ selected, onChange }: SkillPreferencesPickerProps) {
  return (
    <ChipPreferencesPicker
      title="Wanted skills"
      description="Choose which skills teams should balance across students."
      selected={selected}
      options={MATCHING_SKILL_OPTIONS}
      onChange={onChange}
      orderedKeys={ALL_MATCHING_SKILL_KEYS}
      emptyMessage="Selected skills will appear here."
      addLabel="Add skill"
      allSelectedMessage="All skills have been added."
    />
  );
}
